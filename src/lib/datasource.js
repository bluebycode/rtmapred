/*jslint node: true */
'use strict';

var redis   = require('redis');
var Q       = require('q');
var _       = require('underscore');
var util    = require('util');
var events  = require('events');

var mod = exports;

(function(container){
  container.Pool = function Pool(host, port, max, opts){

    this._host = host;
    this._port = port;
    this._connections = [];
    events.EventEmitter.call(this);

    this._options = {
      debug: (opts && opts.debug) ? opts.debug: false
    };

    function random(min, max) {
      return Math.floor(Math.random() * (max - min) + min);
    }

    var self = this;

    // Default selector switching from connections pool
    this._select = function(opts, ceil){
      if (!self._connections ||self._connections.length === 0 ) {
        throw new Error('pool not ready yet');
      }
      var i = random(0,self._connections.length);
      var conn =  self._connections[i].value;
      if (self._options.debug) console.log(util.format(' [%s] %s - pub: %s',ceil,i,conn.pub_sub_mode));
      if (opts && opts.notopics === true && conn.pub_sub_mode && ceil < 3) {
        conn = self._select(opts, ceil+1);
      }
      if (self._options.debug) console.log(util.format('>[%s] %s - pub: %s',ceil,i,conn.pub_sub_mode));
      return conn;
    };

    // Get ready a connection with maximum 3 retries.
    this._create = function(id){
      var defer = Q.defer();
      var client = redis.createClient(self._port, self._host,{
        connect_timeout: 2000,
        max_attempts: 3 // 3 retries!
      });
      client._id = id;
      client.on('connect', function(error){
        defer.resolve(this);
        client.on('error', function(error){
          if (opts && opts.listeners) opts.listeners.onerror.call(this,error);
        });
      });
      return defer.promise;
    };

    // Waking up connections over redis server
    var _future_connections = _.map(_.range(max), function(n){
      return self._create();
    });

    // Once all connection have been settled
    // we are ready to use pool connections.
    Q.allSettled(_future_connections)
      .then(function(connections){
        self._connections = connections;
        self.emit('ready', {
          conn: self._select
        });
      });
  };
  util.inherits(container.Pool, events.EventEmitter);

  container.Pool.prototype.select = function(opts){
    return this._select(opts,0);
  };

})(mod);


/**
 * Block only call for unit testing.
 */
if (process.argv[2] === 'test') {
  var assert = require('assert');
}

/**
 * Connecting to pool from stdin channel.
 */
if (process.argv[2] === 'standalone' && process.argv[1].indexOf('datasource')!==-1) {

  //redis.debug_mode = true;
  var assert = require('assert');

  var pool = new mod.Pool('localhost', 6379, 5);
  pool.on('ready', function(context){
    try {
      context.conn().set('test', 'testing_values');
      context.conn().get('test', function(err,data){
        console.log('get('+'"test"'+') = ',data);
      });
      process.stdin
        .pipe(context.conn().stream)
        .pipe(process.stdout);
    }catch (err){
      console.log(err);
    }
  });
}
