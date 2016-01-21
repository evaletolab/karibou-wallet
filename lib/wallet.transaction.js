/**
 * # transaction
 * This is the controller for all action in regards of charges
 * TODO documentation
 *
 * @author Olivier Evalet <evaleto@gmail.com>
 * @license GPL3 (see LICENSE)
 */

var config = require('./config');
var WalletError = require('./error');
var validator = require('validator');
var debug = config.debug;
var karibou = exports;

// DRIVER
var wallet_drv=require('./wallet.driver.mongoose');

var VALID_TRANSACTIONS = [
    'authorize', 
    'capture', 
    'cancel', 
    'refund'
];


/**
 * ## karibou.Transaction(opts)
 * 
 * @param {Object} opts Transaction options
 * @constructor
 */
karibou.Transaction = function(wid) {

};


/**
 * ## karibou.Transaction.charge(opts)
 * 
 * @param {Object} opts Transaction options
 */

karibou.Transaction.prototype.create = function(wallet,opts) {
  if(!validator.isFloat(opts.amount)){
  }

  var self = this,promise;
  promise=wallet_drv.transaction_charge(wallet,opts);
  promise.then(function (transaction) {
    _.extend(self,transaction);
  })
  return promise;
}

/**
 * ## karibou.Transaction.capture(opts)
 * 
 * @param {Object} opts Transaction options
 */

karibou.Transaction.prototype.capture = function(wallet,opts) {
  var self = this,promise;
  promise=wallet_drv.transaction_capture(wallet,opts);
  promise.then(function (transaction) {
    _.extend(self,transaction);
  })
  return promise;
};

/**
 * ## karibou.Transaction.cancel(opts)
 * 
 * @param {Object} opts Transaction options
 */

karibou.Transaction.prototype.cancel = function(wallet,opts) {
  var self = this,promise;
  promise=wallet_drv.transaction_cancel(wallet,opts);
  promise.then(function (transaction) {
    _.extend(self,transaction);
  })
  return promise;
};

/**
 * ## karibou.Transaction.refund(opts)
 * 
 * @param {Object} opts Transaction options
 */

karibou.Transaction.prototype.refund = function(wallet,opts) {
  var self = this,promise;
  promise=wallet_drv.transaction_refund(wallet,opts);
  promise.then(function (transaction) {
    _.extend(self,transaction);
  })
  return promise;
};
