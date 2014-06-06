var EventEmitter = require('events').EventEmitter;
var io = require('socket.io-client');
var Protocol = require('./../../app/script/protocol.js');

var sock = null;
var id = 1;
var cbDict = {};

var pomelo = Object.create(EventEmitter.prototype);
pomelo.init = function(params, cb) {
  pomelo.params = params;
  params.debug = true;
  var host = params.host;
  var port = params.port;

  var url = 'ws://' + host;
  if(port) {
    url +=  ':' + port;
  }

  sock = io.connect(url, {'force new connection': true, reconnect: false});

  sock.on('connect', function(){
    console.log(actor.id + ' connected ~');
    if (cb) {
      cb(sock);
    }
  });

  sock.on('reconnect', function() {
    console.log('reconnect');
  });

  sock.on('message', function(data){
    if(typeof data === 'string') {
      data = JSON.parse(data);
    }
    if(data instanceof Array) {
      processMessageBatch(pomelo, data);
    } else {
      processMessage(pomelo, data);
    }
  });

  sock.on('error', function(err) {
    console.log(err);
  });

  sock.on('disconnect', function(reason) {
    // console.log(actor.id + ' disconnect ...');
    pomelo.emit('disconnect', reason);
  });
};

pomelo.disconnect = function() {
  if(sock) {
    sock.disconnect();
    sock = null;
  }
};

pomelo.request = function(route) {
  if(!route) {
    return;
  }
  var msg = {};
  var cb;
  arguments = Array.prototype.slice.apply(arguments);
  if(arguments.length === 2){
    if(typeof arguments[1] === 'function'){
      cb = arguments[1];
    }else if(typeof arguments[1] === 'object'){
      msg = arguments[1];
    }
  }else if(arguments.length === 3){
    msg = arguments[1];
    cb = arguments[2];
  }
  msg = filter(msg,route);
  id++; 
  cbDict[id] = cb;
  var sg = Protocol.encode(id,route,msg);
  sock.send(sg);
};

pomelo.notify = function(route,msg) {
  this.request(route, msg);
};

var processMessage = function(pomelo, msg) {
  var route;
  if(msg.id) {
    //if have a id then find the callback function with the request
    var cb = cbDict[msg.id];

    delete cbDict[msg.id];
    if(typeof cb !== 'function') {
      console.log('[pomelo.processMessage] cb is not a function for request ' + msg.id);
      return;
    }

    cb(msg.body);
    return;
  }

  // server push message or old format message
  processCall(msg);

  //if no id then it should be a server push message
  function processCall(msg) {
    var route = msg.route;
    if(!!route) {
      if (!!msg.body) {
        var body = msg.body.body;
        if (!body) {body = msg.body;}
        pomelo.emit(route, body);
      } else {
        pomelo.emit(route,msg);
      }
    } else {
      pomelo.emit(msg.body.route,msg.body);
    }
  }
};

var processMessageBatch = function(pomelo, msgs) {
  for(var i=0, l=msgs.length; i<l; i++) {
    processMessage(pomelo, msgs[i]);
  }
};

function filter(msg,route){
  if(route.indexOf('area.') === 0){
    msg.areaId = pomelo.areaId;
  }

  msg.timestamp = Date.now();
  return msg;
}


function queryEntry(uid, callback) {
  var route = 'gate.gateHandler.queryEntry';
  pomelo.init({
    host: '127.0.0.1',
    port: 3014,
    log: true
  }, function() {
    pomelo.request(route, {
      uid: uid
    }, function(data) {
      pomelo.disconnect();
      if(data.code === 500) {
        console.error('LOGIN_ERROR');
        return;
      }
      callback(data.host, data.port);
    });
  });
};

var username = 'user_';
username += actor.id;

var rid = 'xx';

queryEntry(username, function(host, port) {
  pomelo.init({
    host: host,
    port: port,
    log: true
  }, function() {
    var route = "connector.entryHandler.enter";
    pomelo.request(route, {
      username: username,
      rid: rid
    }, function(data) {
      if(data.error) {
        console.error('DUPLICATE_ERROR');
        return;
      }

      route = "chat.chatHandler.send";
      pomelo.request(route, {
        rid: rid,
        content: 'hi ~',
        from: username,
        target: '*' 
      }, function() {});

    });
  });
});

