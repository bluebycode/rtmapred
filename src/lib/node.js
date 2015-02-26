/*jslint node: true */

var _        = require('underscore');
var util     = require('util');
var events   = require('events');
var Console  = require('./console.js').Console;
var trace    = require('./trace.js')();

var DEBUG = true;

var mod = exports;
(function(container){

  'use strict';

  container.Node = function Node(id, name, options){
    var self = this;

    events.EventEmitter.call(this);
    this._id = id;
    this._name = name;
    this._state = 0;
    this._options = options;

    if (this._options && this._options.console){
      var handlers = _.extend({
        'start': function(){
          trace('started!!');
          self.start();
         },
        'stop' : function(){
          trace('stopped!!');
          self.stop();
        },
        'kill': function(){
          self.shutdown();
        }
      }, this._options.console.handlers || {});
      console.log('****',this._options.console);
      this._console = new Console(this, handlers || {}, this._options.console.opts || {});
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
     return trace('Node object already stopped.');
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



if (process.argv[2] === 'standalone' && process.argv[1]===arguments[3]) {

  console.log('STANDALONE node.js');
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
       },
       'restart': function(){
        server2.stop();
        trace('info!!!', server2._state);
        server2.start();
        trace('info!!!', server2._state);
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
