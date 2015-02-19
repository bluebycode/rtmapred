/*jslint node: true */
'use strict';

var net   = require('net');
var util  = require('util');
var _     = require('underscore');
var stream  = require('stream');
var through = require('through');
var es      = require('event-stream');
var PassThrough = stream.PassThrough ||
      require('readable-stream').PassThrough;

var mod = exports;
(function(container){

  /**
   * [Console representation class]
   * @param {[type]} context  [description]
   * @param {[type]} commands [description]
   */
  container.Console = function Console(context,commands, opts){
    var self = this;
    this._options = _.extend({
      port: 9999,
      stdin: false,
      debug: true
    }, opts);

    this._context = context;

    this._trace = console.log.bind(console.log, util.format('[%s]\t[%s]', new Date().toGMTString(), context.getName()));
    this._commands = commands;

    this._through = es.mapSync(function(data){
      return util.format('%s$ ', data);
    });

    this._channel = new PassThrough();
    this._channel.pipe(process.stdout);
    this._channel.on('data', function(data){
      self._handle(data.toString());
    });

    if (this._options.stdin){
      var through = es.mapSync(function(data){
        return util.format('%s$ ', data);
      });

      process.stdin.write('type command > '+'\n$ ');
      process.stdin
        .pipe(through)
        .pipe(self._channel);
    }

    this._handle = function(line){
      var sliced = line.split('\n')[0].split(' ');
      if (!sliced) {
        self._trace('Invalid command: ', line);
        return;
      }
      var command = sliced[0];
      var argument = sliced[1];
      for (var cmd in self._commands) {
        if (cmd === command){
          self._commands[cmd].call(self._context,argument);
          break;
        }
      }
    };

    this._server = net.createServer();
    this._server.on('connection', function(socket){
      socket.write(self._context.getName()+'.OK'+'\n');
      socket.write('type command > '+'\n$ ');
      socket
        .pipe(self._through)
        .pipe(self._channel);
      self._through.pipe(socket); // only returning result
    });
  };
  container.Console.prototype.wait = function(  ){
    this._trace('listening on',this._options.port);
    this._server.listen(this._options.port);
  };
})(mod);
