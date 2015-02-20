/*jslint node: true */

var util     = require('util');
var events   = require('events');
var es       = require('event-stream');
var _        = require('underscore');
var trace    = require('./trace.js')();
var stream   = require('stream');
var through2 = require('through2');

var net = require('net');

var mod = exports;
(function(container){

  'use strict';

  container.Console = function Console(context, commands, options){
    var self = this;
    this._context = context;
    this._commands = commands;
    this._options = _.extend({
      port: 9999,
      stdin: false,
      debug: true
    }, options);

    this._getCommand = function(rawcommand){
      var cmd = rawcommand.toString().split('\n')[0].split(' ');
      if (!cmd) {
        return trace('Invalid command: ', cmd);
      }
      return {
        id: cmd[0],
        params: cmd[1]
      };
    };

    this._handle_command = function(command, params){
      if (!self._commands[command]){
        return trace('Command not found: ', command);
      }
      try {
        self._commands[command].call(self._context, params);
      } catch (err){
        return false;
      }
      return true;
    };

    this._channel = through2({ objectMode: true, allowHalfOpen: false },
      function (chunk, enc, cb) {
        var _command = self._getCommand(chunk);
        var ret = self._handle_command(_command.id, _command.params);
        cb(null, util.format('%s\n$ ',(ret)?'OK':'KO'));
    });

    if (this._options.stdin){
      process.stdin.write('type command > '+'\n$ ');
      process.stdin
        .pipe(es.mapSync(function(data){
          return util.format('%s$ ', data);
        }))
        .pipe(self._channel)
        .pipe(process.stdout);
    }

    this._server = net.createServer();
    this._server.on('connection', function(socket){
      socket.write('$ ');
      socket
        .pipe(es.mapSync(function(data){
          return util.format('%s$ ', data);
        }))
        .pipe(self._channel)
        .pipe(socket);
    });
  };

  container.Console.prototype.listen = function(){
    trace('listening on port', this._options.port);
    this._server.listen(this._options.port);
  };

  container.Node = function Node(id, name, options){
    events.EventEmitter.call(this);
    this._id = id;
    this._name = name;
    this._state = 0;
    this._options = options;
    if (this._options && this._options.console){
      var handlers = _.extend({
        'start': function(){
          self.start();
         },
        'stop' : function(){
          self.stop();
        },
        'kill': function(){
          self.shutdown();
        }
      }, this._options.console.handlers || {});
      this._console = new container.Console(this, handlers || {}, this._options.console.opts || {});
    }
  };
  util.inherits(container.Node, events.EventEmitter);

  container.Node.prototype.start = function(){
    if (this._state === 1) {
      return console.log('Node object was already running.');
    }
    this._state = 1;
    this.emit('started',this);
  };

  container.Node.prototype.shutdown = function(){
    var handler = this._events.shutdown || (function() { console.log('shutdown signal received'); process.exit(0); });
    process.on('SIGHUP', handler);
    process.kill(process.pid, 'SIGHUP');
  };

  container.Node.prototype.stop = function(){
    if (this._state === 0) {
     return console.log('Node object already stopped.');
    }
    this._state = 0;
    this.emit('stopped',this);
  };

  container.Node.prototype.listen = function(){
    if (this._console) {
      this._console.listen();
    }
  };

})(mod);


if (process.argv[2] === 'standalone'){

  var Server = function Server(id,name, options){
    mod.Node.apply(this, arguments);
    this._server = id;
  };

  util.inherits(Server, mod.Node);
  Server.prototype.listen = function(){
    trace('listening on', this._server, this._id);
  };

  var server = new Server(1,'server');
  server.on('started', function(){
    trace('started!!!');
  });
  server.on('stopped', function(){
    trace('stopped!!!');
  });

  server.listen();

  var terminal = new mod.Console(server, {
    'info': function(){
      trace('information');
     }
  },{
    stdin: true
  });
  terminal.listen();
}


if (process.argv[2] === 'standalone2'){

  var Server2 = function Server(id,name, options){
    mod.Node.apply(this, arguments);
    this._server = id;
  };

  util.inherits(Server2, mod.Node);

  var server2 = new Server2(2,'server2', {
    console: {
      opts: { stdin: true },
      handlers: {
       'info': function(){
        trace('info!!!');
       }
      }
    }
  });
  server2.on('started', function(){
    trace('started!!!');
  });
  server2.on('stopped', function(){
    trace('stopped!!!');
  });

  server2.listen();

}
