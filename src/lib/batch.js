
var DEBUG = true;

var _        = require('underscore');
var events   = require('events');
var util     = require('util');
var trace    = require('./trace.js')();

var mod = exports;
(function(container){

  'use strict';

  container.Batch = function(limit,ttl){
    this._limit = limit;
    this._buffer = [];
    this._ttl = ttl;
    this._lifetime = 0;
    events.EventEmitter.call(this);
  };
  util.inherits(container.Batch, events.EventEmitter);

  container.Batch.prototype.append = function(row){
    var now = Date.now();
    if (this._lifetime === 0) {
      this._lifetime = now;
    }

    if ((now - this._lifetime > this._ttl) ||(this._buffer.length>this._limit)) {
      this._lifetime = 0;
      this.emit('release', this._buffer);
      this._buffer = [];
    }
    this._buffer.push(row);
  };
})(mod);

if (process.argv[2] === 'standalone' && process.argv[1]===arguments[3]) {

  console.log('STANDALONE client.js batch');
  var batch = new mod.Batch(10,1000);
  _.each(_.range(100), function(n){
    batch.append(util.format('%s-%s',n,Math.random(0,n)));
    require('sleep').sleep(Math.floor(Math.random(0,2)*10));
  });

}
