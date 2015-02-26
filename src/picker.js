var DEBUG = true;

var _        = require('underscore');
var util     = require('util');
var events   = require('events');
var stream   = require('stream');
var PassThrough = stream.PassThrough ||
                  require('readable-stream').PassThrough;
var data     = require('./lib/datasource.js');
var Node     = require('./lib/node.js').Node;
var Task     = require('./lib/task.js').Task;
var Batch    = require('./lib/batch.js').Batch;
var trace    = require('./lib/trace.js')();

var mod = exports;
(function(container){

  'use strict';

  var each = function(n, func){
    var ret = [];
    for (var i=0; i<n; i++){
      ret.push(func(i));
    }
    return ret;
  };

  container.EventsPicker = function(channels, connections, options){

    var self = this;
    this._db = connections;
    this._channels = channels;
    this._options = _.extend({
      streams: 4,
      console: {
        opts: { port: 9997, stdin: true },
        handlers: {
         'info': function(){
            console.log('----------------------------------------------------');
            console.log('+ Available commands ------------------------------+\n');
            console.log('start|stop|kill');
            console.log('----------------------------------------------------');
         }
        }
      }
    },options ||{});
    Node.call(this, 0, 'picker', this._options);

    this._subscribeChannels = function(channels, cb){
      trace('subscribing channels.... ', channels);
      cb(null, {});
    };

    this._streams = _.map(_.range(self._options.streams), function(n){
      return new PassThrough();
    });

    self._registerChannels = function(onmessage){
      self._dbtopics = self._db.select();
      self._channels.forEach(function(channel){
        trace('subscribing', channel);
        self._dbtopics.subscribe(channel);
      });
      trace('adding message listener to channels', self._channels);
      self._dbtopics.on('message', function(channel, message){
        trace(util.format('Received message on #%s', channel));
        onmessage(channel, message);
      });
    };

    this._arrange = function(key, partitions, func){
      trace('arrange:',key, partitions);
      self._db.select({notopics: true}).lrange(key, 0, -1, function(err, chunks){
        trace('[',key,'] received',chunks.length,'rows.');
        if (chunks.length === 0) {
          func('no values',0,[]);
          return;
        }

        var partitionSize = function(index, total, partitions){
          var modular = Math.floor(total/partitions)*partitions,
              ratio = modular/partitions,
              delta = total - modular;
           return (delta>0 && index<delta)?ratio+1:ratio;
        };

        each(partitions, function(i){

          var batch = each(partitionSize(i, chunks.length, partitions), function(i){
            return ['rpop', key];
          });

          self._db.select({notopics: true}).multi(batch).exec(function(err, results) {
            func(null,i,results);
          });

        });
      });
    };

    this._start = function(){
      self._registerChannels(function(channel, message){
        trace('channel',channel,'received event!');

        // split the rows binded to channel on different parts
        // which will be send to streams
        self._arrange(channel, self._streams.length, function(err,i,results){
          trace('index:',i,'length:',results.length);
          if (results && results.length > 0){
            results.forEach(function(row){
              self._streams[i].write(row+'\n');
            });
          }
        });
      });
    };
  };
  util.inherits(container.EventsPicker, events.EventEmitter);

  container.EventsPicker.prototype.start = function(){
    this._start();
  };

  container.EventsPicker.prototype.getStreams = function(){
    return this._streams;
  };

})(mod);

if (process.argv[2] === 'standalone' && process.argv[1].indexOf('picker') && process.argv[1]===arguments[3]) {

  var stream  = require('stream');
  var fs = require('fs');
  var _ = require('underscore');

  var conn = new data.Pool('localhost', 6379, 5, {
    listeners: {
      onerror: function(error){
        console.log('error!!', error);
      }
    }
  });

  conn.on('ready', function(context){
    try {
      var eventsPicker = new mod.EventsPicker(['ch1','ch2'],conn);

      _.each(eventsPicker.getStreams(),function(output, i){
        output.pipe(fs.createWriteStream('../logs/stream'+i+'.log'));
      });

    }catch (err){
      trace(err.stack);
    }

  });

}
