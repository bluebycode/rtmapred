
var DEBUG = true;

var trace    = require('./trace.js')();

var mod = exports;
(function(container){

  'use strict';

  var random = function(min, max) {
    return Math.floor(Math.random() * (max - min) + min);
  };
  var pid = function(){
    return Math.floor(Math.random(0,10)*10);
  };

  container.Task = function(interval, func, opts){
    var self = this;

    this._interval = interval;
    this._factor = opts.factor ? opts.factor : 10;
    this._func = func;
    this._state = 0;
    this._pid = null;

    this._oldInterval = setInterval;
    this._setInterval = function(callback, timeout) {
      var inner = this;
      var id = random(0,100);
      this._id = id;
      return self._oldInterval(function() {
        callback();
      }, timeout);
    };

    this._job = function(){
      if (self._state === 2||self._state === 0) {
        self._state = 0;
        clearInterval(self._done);
        return false;
      }
      self._tick++;
      func();
    };

    this._timer =  function(interval){
      if (DEBUG) trace('[task] timer started');
      if (interval){
        self._interval = interval;
      }
      var delayFactor = random(1, self._factor)/10;
      if (DEBUG) trace('[task] delay: [',delayFactor*self._interval,'msec/',delayFactor,'% of',self._interval/1000,'sec.]');
      self._pid = self._setInterval(self._job, delayFactor*self._interval);
    };

    this._tick = 0;
  };

  container.Task.prototype.start = function(interval, retry){
    var self = this;

    if (this._state === 1) {
      trace('task instance still running or stopping process',this._state);
      return;
    }

    if (this._state === 2) {
      if (DEBUG) trace('re-scheduling start');
      setTimeout(function(){
        if (DEBUG) trace('starting from retry');
        self.start(interval, true);
      },1000);
      return;
    }

    if (this._state === 0 && (retry === true)) {
      if (DEBUG) trace('rescheduling WAS A SUCCESS');
    }

    this._state = 1;
    this._timer(interval);
  };

  container.Task.prototype.isStopped = function(){
    return (this._state === 0);
  };

  container.Task.prototype.stop = function(){
    var self = this;

    if (this._state === 1) {
      this._state = 2;
      this._done = this._pid;
    }

    //aborting the retry
    if (this._state === 3) {
      clearTimeout(self._retry);
      this._state = 0;
    }

  };
})(mod);

if (process.argv[2] === 'standalone' && process.argv[1]===arguments[3]) {

  console.log('STANDALONE task.js');
  console.log('this task will stop on tick >5000');
  var modular = Math.floor(Date.now()/1000);
  var task = new mod.Task(1000, function(){
    var tick =  Date.now()%modular;
    console.log('hey!',tick);
    if (tick>13000){
      //task.stop();
    }
  },{});
  task.start();
  setTimeout(function(){
    console.log('stopping task');
    task.stop();
    task.start(300);
    //task.stop();
    //task.start(1);
  },2000);
}
