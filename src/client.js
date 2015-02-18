/*jslint node: true */
'use strict';

var datasource = require('./lib/datasource.js');
var sync    = require('synchronize');
var util    = require('util');
var stream  = require('stream');
var crypto  = require('crypto');
var events = require("events");

var mod = exports;
(function(container){

  function random(min, max) {
    return Math.floor(Math.random() * (max - min) + min);
  }

  container.Client = function(_connections, reqpersec){
    var self = this;
    sync.fiber(function(){
      var onDbConnectionReady = function(connections,cb){
        var _conn = connections;
        connections.on('ready', function(context){
          cb(null, _conn);
        });
      };
      self._dbcontext = sync.await(onDbConnectionReady(_connections, sync.defer()));
    });

    var interval = 200/reqpersec;
    this._intervalFunc = function(delay, func){
      setTimeout(function(){
        func();
        self._intervalFunc(delay, func);
      },random(1,10)*delay);
    };
    this._interval = this._intervalFunc.bind(this,interval);
  };

  container.Tracer = function(filename){
     this._f = require('fs').createWriteStream('stats.csv');
     this._stats = {
      seconds: 0,
      requests: 0,
      rps: {
        requests: 0,
        seconds: 0
      }
    };
  };
  container.Tracer.prototype.trace = function(){
    var now = new Date();
    var seconds = now.getSeconds();

    if (this._stats.seconds != seconds){
        this._stats.rps.requests+=this._stats.requests;
        this._stats.rps.seconds++;

        this._f.write(util.format('%s\t%s\n', now.getTime(), this._stats.rps.requests/this._stats.rps.seconds));

        console.log(util.format('second: %s, req/sq: %s, average: %s - %s (%s)',this._stats.seconds, this._stats.requests,this._stats.rps.requests,this._stats.rps.seconds,this._stats.rps.requests/this._stats.rps.seconds));
        this._stats.requests = 0;
        this._stats.seconds = seconds;
      }else{
        this._stats.requests++;
      }
  };

  container.Client.prototype.start = function(){
    var tracer = new container.Tracer('output.csv');
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
        console.log('ttl raised? :',(now - this._lifetime), this._ttl, ' or limit?: ', this._buffer.length, this._limit);
        this._buffer = [];
        this._lifetime = 0;
        this.emit('release');
      }
      this._buffer.push(row);
    };

    var multi = null;
    var buffer = new Buffer(1000,3500);
    this._interval(function(){

      if (!multi) {
        console.log('!!!!');
        multi = self._dbcontext.select().multi();
        buffer.on('release', function(){
          multi.exec(function (err, replies) {
            console.log('release with', replies.length);
          });
        });
      }

      if (multi){
        tracer.trace();
        var hash = crypto.randomBytes(64).toString('hex');
        var i = random(0,options.length);
        var option = options[i];
        buffer.append(0);
        multi.lpush(option,hash);
      }

    });
    this._intervalFunc(1000,function(){
      var option = options[random(0,options.length - 1)];
      console.log('**************************************');
      self._dbcontext.select().publish(option, 'ready');
    });
  };

})(mod);

if (process.argv[2] === 'standalone') {

  var conn = new datasource.Pool('localhost', 6379, 5);
  var client = new mod.Client(conn, 20);
  client.start();

}

