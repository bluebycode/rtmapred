/*jslint node: true */
'use strict';

var _        = require('underscore');
var util     = require('util');
var es       = require('event-stream');
var stream   = require('stream');
var through2 = require('through2');
var net      = require('net');
var trace    = require('./trace.js')();

var PassThrough = stream.PassThrough ||
  require('readable-stream').PassThrough;

var DEBUG = true;

var mod = exports;
(function(container){

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
        trace(err.stack);
        return false;
      }
      return true;
    };

    this._handler_command = function(chunk){
      var _command = self._getCommand(chunk);
      var ret = self._handle_command(_command.id, _command.params);
      return util.format('%s\n$ ',(ret)?'OK':'KO');
    };

    if (this._options.stdin){
      process.stdin.write('type command > '+'\n$ ');
      process.stdin
        .pipe(es.mapSync(function(data){
          return util.format('%s$ ', data);
        }))
        .pipe(es.mapSync(this._handler_command))
        .pipe(process.stdout);
    }

    this._server = net.createServer({
      allowHalfOpen: true
    });
    this._server.on('connection', function(socket){

      socket.write('$ ');
      socket
        .pipe(es.mapSync(function(data){
          return util.format('%s$ ', data);
        }))
        .pipe(es.mapSync(self._handler_command))
        .pipe(socket, {end:false});
    });
  };

  container.Console.prototype.listen = function(){
    trace('listening on port', this._options.port);
    this._server.listen(this._options.port);
  };
})(mod);

/*
if (process.argv[2] === 'standalone' && process.argv[1].indexOf('console')) {

  var handlers = _.extend({
    'start': function(){
      trace('started!!');
     },
    'stop' : function(){
      trace('stopped!!');
    }
  }, {});

  var options =  {
    stdin: true,
    port: 8888
  };

  var terminal = new mod.Console(this, handlers, options);
  terminal.listen();
}
*/
