/*jslint node: true */
'use strict';

var util    = require('util');
var stream  = require('stream');
var crypto  = require('crypto');
var model   = require('cluster-stream');
var PassThrough = stream.PassThrough ||
  require('readable-stream').PassThrough;

var pass = new PassThrough();
model(pass, process.stdout, 'unit', {
  clients: 52
});

var interval = function(func, delay){
  setTimeout(function(){
    func();
    interval(func, Math.random(1,10)*delay);
  },delay);
};

interval(function(){
  var line = util.format('hash:@%s\n', crypto.randomBytes(64).toString('hex')+'\n');
  pass.write(line);
},500);

process.stdin.pipe(process.stdout);
