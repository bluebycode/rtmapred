/*jslint node: true */
'use strict';

var redis   = require('redis');
var Q       = require('q');
var _       = require('underscore');
var util    = require('util');
var events  = require('events');

var mod = exports;

(function(container){

  container.Topics = function(conn, channels){
    this._channels = channels;

    var trace = console.log.bind(console.log, '[' + this._channels.toString() + ']');

    var self = this;
    var _bindConnSelector = function(conn){
      var nested = this;
      var defer = Q.defer();
      var _connection = conn;
      _connection.on('ready', function(_c){
        defer.resolve(_connection._select.bind(_connection)());
      });
      return defer.promise;
    };

    // Bind the function with the selector of connections
    // belongs to connection pool passed as argument on class.
    self._conn = _bindConnSelector(conn);

    this._subscription = function(channel, message){
      trace(channel, message); // default one
    };

    // Subscribe the channel and bind the callback when message arrives event.
    this._subscribe = function(cb){
      self._conn.then(function(conn){
        self._channels.forEach(function(channel){
          conn.subscribe(channel);
        });
        if (cb) self._subscription = cb;
      });
    };

    self._conn.then(function(conn){
      conn.on('message', function(channel, message){
        self._subscription(channel, message);
      });
    });
  };

  /**
   * Registers the topic and does callback when message event arrives.
   * @param  {Function} cb callback when data ready.
   */
  container.Topics.prototype.on = function(cb){
    this._subscribe(cb);
  };

  container.Range = function Range(pool){
    var self = this;
    var defer = Q.defer();
    events.EventEmitter.call(this);

    self._pool = pool;
    self._pool.on('ready', function(){
      var _parent = self._pool;
      defer.resolve(_parent._select.bind(_parent)());
    });
    self._conn = defer.promise;

    self._promisify = function(async, context) {
      return function() {
        var defer = Q.defer(),
             args = Array.prototype.slice.call(arguments);

        args.push(function(err, val) {
          if (err !== null) {
            return defer.reject(err);
          }
          return defer.resolve(val);
        });

        async.apply(context || {}, args);
        return defer.promise;
      };
    };

    self._get_connection = function(call){
      self._conn.then(function(_connection){
        try {
          console.log(call.call());
          call(null, _connection);
        } catch (err) {
          call(err, _connection);
        }
      });
    };

    self._call = function(f,action){
      var args = Array.prototype.slice.call(arguments,1);
      return self._get_connection(function(err, _c){
        return _c[f].apply(_c || {}, args);
      });
    };

    self._commands = {
      get:   self._call.bind(self, 'get'),
      lrange: self._call.bind(self, 'lrange')
    };

    self._arrange = function(key, partitions, func){

      var range   = self._commands.lrange.bind(self._commands, key, 0, -1);
      var promise = self._promisify(range);

      promise()
        .then(function(chunks){

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

          _.each(_.range(partitions),function(i){

            var batch = _.map(_.range(partitionSize(i, chunks.length, partitions)), function(i){
              return ['rpop', key];
            });

            self._pool._select().multi(batch).exec(function(err, results) {
              func(null,i,results);
            });
          });
      });
    };

    container.Range.prototype.arrange = function(key, partitions, func){
      return this._arrange(key, partitions, func);
    };
  };
})(mod);

/**
 * Block only call for unit testing.
 */
if (process.argv[2] === 'test') {
  var assert = require('assert');
}

/**
 * Run connector.js module as standalone with n partitions
 * node connector.js standalone <partitions>.
 *
 * i.e node connector.js standalone 1
 */
if (process.argv[2] === 'standalone') {


  var func = function(error, index, rows){
    var show = function(part){
      if (rows && rows.length > 0){
        console.log('Partition ['+index+'], size:',rows.length);
         _.each(rows,function(e,i){
          console.log('(',i,') -> ', e);
        });
      }else{
        console.log('Partition ['+index+'], No values.');
      }
      return;
    };
    if (error){
      console.log(error);
      return;
    }
    return show(rows);
  };

  try {

    // pool connections definition
    var Pool = require('./datasource.js').Pool;
    var conn = new Pool('localhost', 6379, 5);

    conn.on('ready', function(context){
      var multi = context.conn().multi();
      _.each(_.range(Math.floor(Math.random(15)*100)), function(e){
        multi.lpush('stack1', 'test'+e);
        console.log('stack1', 'test'+e);
      });

      multi.exec(function (err, replies) {
        console.log(replies.length);
      });

    });

    var chunks = new mod.Range(conn);
    chunks.arrange('stack1',3, function(err,i,results){
      console.log('index:',i,'length:',results.length);
    });

    console.log('Done, listening on topics!!!');

    var stream  = require('stream');
    var PassThrough = stream.PassThrough ||
      require('readable-stream').PassThrough;

    var pass = new PassThrough();
    pass.pipe(process.stdout);


     //console.log(connection.get('dddd'));

    var topics = new mod.Topics(conn, ['ch1','ch2']);
    topics.on(function(channel, message){
      var connection = conn.select();

      //conn.select().lpush(channel, ''+Math.floor(Math.random(150)*1000));
      /*conn.select().lpush(channel, ''+Math.floor(Math.random(150)*1000));
      conn.select().lpush(channel, ''+Math.floor(Math.random(150)*1000));
      conn.select().lpush(channel, ''+Math.floor(Math.random(150)*1000));*/
      pass.write(util.format('[%s]\t%s\n',channel, message));
      /*chunks.arrange(channel,3, function(err,i,results){
        console.log('index:',i,'length:',results.length);
      });*/
    });




  } catch (err){

    console.log(err.stack);
  }
  process.stdin.pipe(process.stdout);

}

