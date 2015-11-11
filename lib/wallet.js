/**
 * #wallet
 *
 * @author Olivier Evalet <evaleto@gmail.com>
 * @license GPL3 (see LICENSE)
 */

var config = require('./config');
var debug = config.debug;
var check = require('./check');
var WalletError = require('./error');
var _=require('underscore');

// DRIVER
var wallet_drv=require('./wallet.driver.mongoose')

var account = exports;



/**
 * ## account.Wallet(opts)
 * @param {Object} opts Payment method options
 * @constructor
 */
function Wallet(opts) {
  var self = this;

}

/**
 * ## account.Wallet.isValid()
 * *Validate the card data*
 *
 * This method validates the correctness of the card number and CSC. It uses
 * the industry-standard Luhn Mod-10 check to ensure that the card number's
 * checksum is correct. It also makes sure that the CSC has the correct number
 * of digits (currently, AMEX cards have 4-digit CSC, while others use 3
 * digits).
 *
 * Note that the card may still fail to clear for any number of reasons. The
 * same check as this one is performed in the Samurai gateway, as well, however
 * if you create payment methods using server-to-server requests, rather than
 * letting Samurai create payment methods by submitting the payment form
 * directly to Samurai, then this can speed up processing as you can trap
 * some common errors without sending a request to Samurai.
 *
 * @returns {Boolean} Validation result
 */
Wallet.prototype.isValid = function() {
  if (!check.mod10check(this.card.number)) {
    return false;
  }

  return (this.isAvailable);
};

/**
 * ## account.Wallet.isExpired()
 * Checks the card expiration year/month
 *
 * If the year and month are not specified, the check will return `true`.
 *
 * This method does _not_ correct the expiration year/month.
 *
 *
 * @returns {Boolean} Check result
 */
Wallet.prototype.isExpired = function() {
  var expYear = parseInt(new Date().getFullYear())-2000;
  var expMonth = new Date().getMonth() + 1; // 0-indexed
  var expiry=tools.readExpiry(self.card.expiry);

  if (!expiry) { return true; }

  // Expired card should not be last month this year or older
  if (expiry[0] < expYear) { return true; }
  if (expiry[0] === expYear && expiry[1] < expMonth) { return true; }

  return false;
};



/**
 * ## account.Wallet.create(wallet,callback)
 *
 * @param {Function} callback Expects err object
 */
Wallet.prototype.create = function(wallet) {
  var self = this,promise;
  // wallet.id => int
  // wallet.email => email
  
  promise=wallet_drv.create(wallet);
  promise.then(function (wallet) {
    _.extend(self,wallet);
  })
  return promise;
};


/**
 * ## account.Wallet.retrieve(wid,callback)
 *
 * @param {Function} callback Expects err object
 */
Wallet.prototype.retrieve = function(wallet) {
  var self = this,promise;
  promise=wallet_drv.retrieve(wallet);
  promise.then(function (wallet) {
    _.extend(self,wallet);
  });
  return promise;
};


/**
 * ## account.Wallet.retrieveAllGift()
 *
 * @param {Function} callback Expects err object
 */
Wallet.prototype.retrieveAllGift = function() {
  var self = this,promise;
  promise=wallet_drv.retrieveAllGift();
  return promise;
};

/**
 * ## account.Wallet.update(wallet,callback)
 *
 * @param {Function} callback Expects err object
 */
Wallet.prototype.update = function(wallet,update) {
  var self = this,promise;
  promise=wallet_drv.update(wallet,update);
  promise.then(function (wallet) {
    _.extend(self,wallet);
  });
  return promise;
};


/**
 * ## account.Wallet.updateExpiry(wid,giftcard,callback)
 *
 * @param {Function} callback Expects err object
 */
Wallet.prototype.updateExpiry = function(wallet,expiry) {
  var self = this,promise;
  promise=wallet_drv.updateExpiry(wallet,{expiry:expiry});
  promise.then(function (wallet) {
    _.extend(self,wallet);
  });
  return promise;
};



/**
 * ## account.Wallet.updateAvailable(wid,giftcard,callback)
 *
 * @param {Function} callback Expects err object
 */
Wallet.prototype.updateAvailable = function(wallet,available) {
  var self = this,promise;
  promise=wallet_drv.updateExpiry(wallet,available);
  promise.then(function (wallet) {
    _.extend(self,wallet);
  })
  return promise;
};

/**
 * ## account.Wallet.updateTransfer(wid,giftcard,callback)
 *
 * @param {Function} callback Expects err object
 */
Wallet.prototype.updateTransfer = function(wallet,available) {
  var self = this,promise;
  promise=wallet_drv.updateTransfer(wallet,available);
  promise.then(function (wallet) {
    _.extend(self,wallet);
  })
  return promise;
};



account.Wallet = Wallet;
