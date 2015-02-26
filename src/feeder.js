var DEBUG = true;

var _        = require('underscore');
var util     = require('util');
var events   = require('events');
var data     = require('./lib/datasource.js');
var Node     = require('./lib/node.js').Node;
var Task     = require('./lib/task.js').Task;
var Batch     = require('./lib/batch.js').Batch;
var trace    = require('./lib/trace.js')();

var mod = exports;
(function(container){

  'use strict';

  container.Feeder = function(channels, connections, options){
    var self = this;

    function rps2msec(rps){
      return 1000/rps;
    }

    this._options = _.extend({
      batch: {
        size: 1000,
        ttl: 1500
      },
      console: {
        opts: { stdin: true },
        handlers: {
         'info': function(){
            console.log('----------------------------------------------------');
            console.log('+ Available commands ------------------------------+\n');
            console.log('start|stop|kill');
            console.log('rps <number>');
            console.log('----------------------------------------------------');
         },
         'rps': function(rps){
           console.log('RPS. turned into', rps,'events per second.');
           this._timer.stop();
           this._timer.start(rps2msec(rps));
         }
        }
      },
      rps: 1
    },options ||{});
    Node.call(this, 0, 'feeder', this._options);

    this._db = connections;
    this._batch = new Batch(this._options.batch.size,this._options.batch.ttl);
    this._batch.on('release', function(rows){
      self._sendEvents(rows);
    });

    // setting up a timer who send event every request
    this._timer = new Task(rps2msec(this._options.rps), function(){
      if (self._events.feed) {
        self._batch.append(self._events.feed());
      }
    },{});

    this._sendEvents = function(rows){
      trace('sending',rows.length,'rows.');
      var topics = {};
      var multi = self._db.select().multi();
      rows.forEach(function(row){
        topics[row.key]=1;
        multi.lpush(row.key, row.data);
      });
      multi.exec(function (err, replies) {
        Object.keys(topics).forEach(function(topic){
          self._db.select().publish(topic, 'ready');
        });
      });
      trace('publishing', rows.length, ' on ', Object.keys(topics));
    };

    this.start = function(rps){
      this._timer.start(rps2msec((rps)?rps:this._options.rps));
    };

    this.stop = function(){
      this._timer.stop();
    };
  };
  util.inherits(container.Feeder, events.EventEmitter);

  container.Feeder.prototype.run = function(rps){
    this.start(rps);
  };

})(mod);

if (process.argv[2] === 'standalone' && process.argv[1].indexOf('feeder') && process.argv[1]===arguments[3]) {

  var crypto  = require('crypto');

  var random = function(min, max) {
    return Math.floor(Math.random() * (max - min) + min);
  };

  var conn = new data.Pool('localhost', 6379, 5);
  conn.on('ready', function(){

    var eventsPerSeconds = process.argv[3];
    var channels = ['ch1','ch2','ch3','ch4'];
    var feeder = new mod.Feeder(channels, conn, {
      rps: 1,
      batch: { size: 100, ttl: 10000 }
    });

    feeder.on('feed', function(){
      var hash = crypto.randomBytes(64).toString('hex');
      var topic = channels[random(0,channels.length)];
      var row = {
        k: util.format('%s,%s', new Date().getTime(), topic),
        v: util.format('user=%s|token=%s', random(0,100000), hash)
      };
      return { key: topic, data: JSON.stringify(row) };
    });
    feeder.run(eventsPerSeconds);
  });


}


