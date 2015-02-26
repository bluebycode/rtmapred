var util = require('util');

module.exports = function(){
  //if (arguments.callee.caller !== null) {
  //var module = arguments.callee.caller.arguments[3].replace(/^.*\/|\.[^.]*$/g, '');
  return function(){
    var now = new Date().toGMTString();
    var trace = console.log.bind(console.log, util.format('[%s]\t',now));
    trace.apply(this, arguments);
  };
};
