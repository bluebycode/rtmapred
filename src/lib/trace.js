var util = require('util');

module.exports = function(){
  var module = arguments.callee.caller.arguments[3].replace(/^.*\/|\.[^.]*$/g, '');
  return console.log.bind(console.log, util.format('[%s]\t[%s]', new Date().toGMTString(),module));
};
