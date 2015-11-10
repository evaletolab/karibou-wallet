/**
 * #config
 * Copyright (c)2014, by Olivier Evalet <evaleto@gmail.com>
 * Licensed under GPL license (see LICENSE)
 */

var config = exports;
var util = require('util');
var WalletError = require('./error');
var isConfigured = false;

config.WALLET_VERSION = '0.0.1';

/**
 * ## settings
 * *Master configuration settings for Wallet*
 * 
 */
var settings = {};
settings.allowMaxAmount=1000.00; // block charge (payment) above
settings.sandbox = false;
settings.enabled = true; // Does not make any actual API calls if false
settings.debug = false; // Enables *blocking* debug output to STDOUT
settings.apiVersion = 1; // Don't change this... unless you need to
settings.allowMultipleSetOption = false;
settings.mongo={
  name:'mongodb://localhost/wallet-test',
  ensureIndex:true,
};

settings.apikey='123456789';
settings.secret='walletapi';
settings.currency = 'CHF';
settings.allowedCurrencies = ['CHF'];

config.reset=function(){
  if(process.env.NODE_ENV=='test'){
    settings.sandbox = false;
    settings.enabled = true;
    settings.currency = 'CHF';
    settings.allowedCurrencies = ['CHF'];
    isConfigured=false;
  }
  else throw new Error('Reset is not possible here')
}
/**
 * ## config.debug(message)
 * *Wrapper around `util.debug` to log items in debug mode*
 *
 * This method is typically used by Wallet implementation to output debug 
 * messages. There is no need to call this method outside of Wallet.
 *
 * Note that any debug messages output using this function will block 
 * execution temporarily. It is advised to disable debug setting in production 
 * to prevent this logger from running.
 * 
 * @param {Object} message Object to be output as a message
 * @private
 */
config.debug = debug = function(message) {
  if (settings.debug) {
    util.debug(message);
  }
};

/**
 * ## config.configure(opts)
 * *Set global Wallet configuration options*
 *
 * This method should be used before using any of the Wallet's functions. It
 * sets the options in the `settings` object, and performs basic validation 
 * of the options before doing so.
 *
 * Unless you also pass it the `allowMultipleSetOption` option with value set 
 * to `true`, you will only be able to call this method once. This is done to 
 * prevent accidental calls to this method to modify critical options that may
 * affect the security and/or correct operation of your system.
 *
 * This method depends on ``config.option()`` method to set the individual 
 * options.
 *
 * If an invalid option is passed, it will throw an error.
 *
 * @param {Object} Configuration options
 */
config.configure = function(opts) {
  debug('Configuring Wallet with: \n' + util.inspect(opts));
  if (!opts.apikey) {
    throw new WalletError('system', 'Incomplete Wallet API credentials', opts);
  }
  Object.keys(opts).forEach(function(key) {
    config.option(key, opts[key]);
  });
  isConfigured = true;
};

/**
 * ## config.option(name, [value])
 * *Returns or sets a single configuration option*
 *
 * If value is not provided this method returns the value of the named
 * configuration option key. Otherwise, it sets the value and returns it.
 *
 * Setting values can only be set once for most options. An error will be 
 * thrown if you try to set an option more than once. This restriction exist
 * to prevent accidental and/or malicious manipulation of critical Wallet 
 * configuration options.
 *
 * During testing, you may set the `allowMultipleSetOption` to `true` in order
 * to enable multiple setting of protected options. Note that once this option
 * is set to `false` it can no longer be set to true.
 *
 * Wallet API credentials are additionally checked for consistency. If they 
 * do not appear to be valid keys, an error will be thrown.
 *
 * @param {String} option Name of the option key
 * @param {Object} value New value of the option
 * @returns {Object} Value of the `option` key
 */
config.option = function(option, value) {
  if (typeof value !== 'undefined') {
    debug('Setting Wallet key `' + option + '` to `' + value.toString() + '`');
    

    // Do not allow an option to be set twice unless it's `currency`
    if (isConfigured && 
        !settings.allowMultipleSetOption && 
        option !== 'currency') {
      throw new WalletError(
        'system', 
        'Option ' + option + ' is already locked', 
        option);
    }

    switch (option) {
    case 'mongo':
    case 'apikey':
    case 'currency':
    case 'secret':
      settings[option] = value;
      break;
    case 'allowMaxAmount':
      settings[option] = parseFloat(value)
      break;
    case 'sandbox':
    case 'enabled':
    case 'debug':
    case 'shaWithSecret':
    case 'allowMultipleSetOption':
      settings[option] = Boolean(value);
      break;
    case 'allowedCurrencies':
      if (!Array.isArray(value)) {
        throw new WalletError('system', 'Allowed currencies must be an array', null);
      }
      if (value.indexOf(settings.currency) < 0) {
        value.push(settings.currency);
      }
      settings.allowedCurrencies = value;
      break;
    default:
      // Do not allow unknown options to be set
      throw new WalletError('system', 'Unrecognized configuration option', option);
    }
  }
  return settings[option];
};

