/**
 * # karibou
 * This is the controller for all action in regards of charges
 * TODO documentation
 *
 * @author Olivier Evalet <evaleto@gmail.com>
 * @license GPL3 (see LICENSE)
 */

var config = require('./config');
var WalletError = require('./error');
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
 * ## karibou.Transfer(opts)
 * 
 * @param {Object} opts Transfer options
 * @constructor
 */
karibou.Transfer = function(wid) {
  function isFloat(n) {
    return n === +n && n !== (n|0);
  }

};


/**
 * ## karibou.Transfer.create(opts)
 * 
 * @param {Object} opts Transfer options
 */

karibou.Transfer.prototype.create = function(wallet,opts) {
  function isFloat(n) {
    return n === +n && n !== (n|0);
  }

  var self = this,promise;
  promise=wallet_drv.transfer_create(wallet,opts);
  promise.then(function (transfer) {
    _.extend(self,transfer);
  })
  return promise;
}


/**
 * ## karibou.Transfer.cancel(opts)
 * 
 * @param {Object} opts Transfer options
 */

karibou.Transfer.prototype.cancel = function(wallet,opts) {
  var self = this,promise;
  promise=wallet_drv.transfer_cancel(wallet,opts);
  promise.then(function (transfer) {
    _.extend(self,transfer);
  })
  return promise;
};


