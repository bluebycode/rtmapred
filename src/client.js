/*jslint node: true */
'use strict';

var datasource = require('./lib/datasource.js');
var Console = require('./lib/console.js').Console;
var sync    = require('synchronize');
var util    = require('util');
var stream  = require('stream');
var crypto  = require('crypto');
var events = require("events");
var _ = require('underscore');

var mod = exports;
(function(container){

  var trace = console.log.bind(console.log, util.format('[%s]\t[simulator]', new Date().toGMTString()));

  function random(min, max) {
    return Math.floor(Math.random() * (max - min) + min);
  }

  container.Client = function(_connections, options){
    var self = this;
    this._options = _.extend({
      rps: 20,
      batch: {
        limit: 1000,
        ttl: 3000
      },
      debug: true
    }, (options)? options : {});

    this._name = 'client';

    sync.fiber(function(){
      var onDbConnectionReady = function(connections,cb){
        var _conn = connections;
        connections.on('ready', function(context){
          cb(null, _conn);
        });
      };
      self._dbcontext = sync.await(onDbConnectionReady(_connections, sync.defer()));
    });

    var interval = 200/self._options.rps;

    this._intervalFunc = function(delay, func){
      return setTimeout(function(){
        func();
        self._intervalFuncPid = self._intervalFunc(delay, func);
      },random(1,10)*delay);
    };
    this._interval = this._intervalFunc.bind(this,interval);

    this._state = 0; // state

    this._console = new Console(self, {
      'info': function(){
        return util.format('%s: %s\n', 'rps', this._options.rps);
      },
      'start': function(){
        if (this._state === 1) {
          return trace('another instance is running!');
        }
        this._state = 1; // started!
        this.start();
      },
      'rps' : function(rps){
        this._options.rps = rps;
        this.refresh();
      }
    },{
      stdin: true
    });

  };

  container.Tracer = function(filename, options){
      this._f = require('fs').createWriteStream('stats.csv');
      this._options = _.extend({
        debug: false
      },options);

      this._stats = {
        seconds: 0,
        requests: 0,
        rps: {
          requests: 0,
          seconds: 0
        },
        debug: false
      };
  };

  container.Tracer.prototype.trace = function(){
    var now = new Date();
    var seconds = now.getSeconds();

    if (this._stats.seconds != seconds){
        this._stats.rps.requests+=this._stats.requests;
        this._stats.rps.seconds++;

        this._f.write(util.format('%s\t%s\n', now.getTime(), this._stats.rps.requests/this._stats.rps.seconds));

        if (this._options.debug)
          console.log(util.format('second: %s, req/sq: %s, average: %s - %s (%s)',this._stats.seconds, this._stats.requests,this._stats.rps.requests,this._stats.rps.seconds,this._stats.rps.requests/this._stats.rps.seconds));

        this._stats.requests = 0;
        this._stats.seconds = seconds;
      }else{
        this._stats.requests++;
      }
  };

  container.Client.prototype.getName = function(){
    return this._name;
  };

  container.Client.prototype.refresh = function(){
    clearTimeout(this._intervalFuncPid);
    this._intervalFunc(200/this._options.rps, this._push);
    if (this._options.debug) trace('refreshing with rps: ', this._options.rps);
  };

  container.Client.prototype.start = function(){
    console.log('start!!!!!!!');
    var tracer = new container.Tracer('output.csv', {debug:true});
    var options = ['channel1','channel2']; // @TODO, ride out of this method.
    var self = this;

    var Buffer = function Buffer(n,ttl){
      this._limit = n;
      this._buffer = [];
      this._ttl = ttl;
      this._lifetime = 0;
      events.EventEmitter.call(this);
    };

    util.inherits(Buffer, events.EventEmitter);
    Buffer.prototype.append = function(row){
      var now = Date.now();
      if (this._lifetime === 0) this._lifetime = now;
      if ((now - this._lifetime > this._ttl) ||(this._buffer.length>this._limit)) {
        if (self._options.debug) trace('ttl raised? :',(now - this._lifetime), this._ttl, ' or limit?: ', this._buffer.length, this._limit);
        this._buffer = [];
        this._lifetime = 0;
        this.emit('release');
      }
      this._buffer.push(row);
    };

    var multi = null;

    this._buffer = new Buffer(self._options.batch.limit,self._options.batch.ttl);

    this._push = function(){
      if (!multi) {
        multi = self._dbcontext.select().multi();
        self._buffer.on('release', function(){
          multi.exec(function (err, replies) {
            if (self._options.debug)
              trace('release of', replies.length, 'events');
            options.forEach(function(channel){
              self._dbcontext.select().publish(channel, 'ready');
            });
          });
        });
      }

      if (multi){
        tracer.trace();
        var hash = crypto.randomBytes(64).toString('hex');
        var i = random(0,options.length);
        var option = options[i];
        self._buffer.append(0);
        multi.lpush(option,hash);
      }
    };

    this._current_interval = this._interval(this._push);
   /* this._intervalFunc(1000,function(){
      var option = options[random(0,options.length - 1)];

      if (self._options.debug)
        trace('**************************************');

      self._dbcontext.select().publish(option, 'ready');
    });*/
  };

  container.Client.prototype.waiting = function(){
    this._console.wait();
    trace('Waiting for commands>');
  };

})(mod);

if (process.argv[2] === 'standalone') {

  var rps = process.argv[3];
  var conn = new datasource.Pool('localhost', 6379, 5);
  var client = new mod.Client(conn, { rps: (rps)?rps:20 , debug: true});
  client.waiting();
}

