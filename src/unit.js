/*jslint node: true */
"use strict";

var through = require('through');
var util    = require('util');

var source = function(id){
  return through(function(chunk){
    this.queue(util.format('[%s] %s %s\n', Date.now(), id, chunk));
  });
};
module.exports = source;

