/*jslint node: true */
'use strict';

var net   = require('net');
var util  = require('util');
var sync = require('synchronize');
var stream  = require('stream');
var Console = require('../lib/console.js').Console;
var PassThrough = stream.PassThrough ||
      require('readable-stream').PassThrough;


var mod = exports;
(function(container){

  var trace = console.log.bind(console.log, util.format('%s\t[collector]', new Date().toGMTString()));

  var filter = function(objects, field) {
    return objects.map(function(obj){
      return obj[field];
    });
  };

  var each = function(n, func){
    var ret = [];
    for (var i=0; i<n; i++){
      ret.push(func(i));
    }
    return ret;
  };

  /**
   * [Collector representation class]
   * @param {[type]} _poolConnections [description]
   */
  container.Collector = function Collector(_poolConnections){
    var self = this;

    this._name = 'collector';

    this._state = 0; // stopped
    this._subscribeChannels = function(channels, cb){
      trace('subscribing channels.... ', channels);
      cb(null, {});
    };

    sync.fiber(function(){
      var onDbConnectionReady = function(connections,cb){
        var _conn = connections;
        connections.on('ready', function(context){
          cb(null, _conn);
          //cb(null, context);
        });
      };
      self._dbcontext = sync.await(onDbConnectionReady(_poolConnections, sync.defer()));

      self._dbtopics = self._dbcontext.select();
      self._dbtopics.on('error', function(error){
        trace('error',error);
      });
    });

    self._registerChannels = function(cb){
      self._channels.forEach(function(channel){
        self._dbtopics.subscribe(channel);
      });
      self._dbtopics.on('message', function(channel, message){
        trace(util.format('Received message on #%s', channel));
        cb(channel, message);
      });
    };


    self._arrange = function(key, partitions, func){
      self._dbcontext.select({notopics: true}).lrange(key, 0, -1, function(err, chunks){
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

          self._dbcontext.select({notopics: true}).multi(batch).exec(function(err, results) {
            func(null,i,results);
          });

        });
      });
    };

    self._start = function(){
      trace('Starting node!');
      self._registerChannels(function(channel, message){
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

    this._console = new Console(self, {
      'info': function(){
        var line = function(k, v) { return util.format('%s: [%s]\n',k,v);};
        var output = line('channels',this._channels.toString());
        output +=line('streams',filter(streams,'path').toString());
        return output;
      },
      'start': function(){
        if (this._state === 1) {
          return trace('another instance is running!');
        }
        this._state = 1; // started!
        this._start();
      }
    }, { port: 9998, debug: true, stdin: true});
  };

  container.Collector.prototype.getName = function(){
    return this._name;
  };

  container.Collector.prototype.setChannels = function(channels){
    trace('setting channels:',channels);
    this._channels = channels;
  };

  container.Collector.prototype.setOutputs = function(streams){
    var self = this;
    self._streams = [];
    trace('setting outputs streams:', filter(streams,'path'));
    streams.forEach(function(stream){
      var pass = new PassThrough();
      pass.pipe(stream);
      self._streams.push(pass);
    });
  };

  container.Collector.prototype.waiting = function(){
    this._console.wait();
    trace('Waiting for commands>');
  };

})(mod);


if ((process.argv[2]) == 'standalone') {

  var stream  = require('stream');
  var fs = require('fs');
  var _ = require('underscore');

  var Pool = require('../lib/datasource.js').Pool;
  var conn = new Pool('localhost', 6379, 5, {
    listeners: {
      onerror: function(error){
        console.log('error!!', error);
      }
    }
  });

  if ((process.argv[3]) == 'test'){
    conn.on('ready', function(context){
      var multi = conn.select().multi();
      _.each(_.range(Math.floor(Math.random(15)*100)), function(e){
        multi.lpush('channel1', 'test'+e);
        console.log('channel1', 'test'+e);
      });
      _.each(_.range(Math.floor(Math.random(15)*100)), function(e){
        multi.lpush('channel2', 'test'+e);
        console.log('channel2', 'test'+e);
      });

      multi.exec(function (err, replies) {
        console.log(replies.length);
      });
    });
  }

  var streams = _.map(_.range(4), function(i){
    var stream = fs.createWriteStream('output'+i+'.log');
    return stream;
  });

  var collector = new mod.Collector(conn);
  collector.setChannels(['channel1','channel2']);
  collector.setOutputs(streams);
  collector.waiting();
}
