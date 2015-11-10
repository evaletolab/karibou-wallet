/**
 * # error
 *
 * Copyright (c)2015, by evaleto@gmail.com
 *
 *
 * @license MIT (see LICENSE)
 */

var util = require('util');
var messages = require('./messages');

/**
 * ## error.WalletError
 * 
 * @constructor
 */
function WalletError(category, message, details, more) {
  more=more&&(': '+more)||''
  Error.call(this);
  Error.captureStackTrace(this, this.constructor);
  var status=parseInt(message),code=parseInt(details);
  this.category = category;
  this.code=code||undefined
  this.message = !isNaN(status)&&(messages.getStatus(status)+more)||message;
  this.details = code&&messages.getDescription(code)||details;
  this.name = this.constructor.name;
}

util.inherits(WalletError, Error);

WalletError.prototype.toString = function() {
  return this.category + ': ' + this.message + ': ' +
    util.inspect(this.details);
};

module.exports = WalletError;
