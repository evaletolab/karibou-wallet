/**
* #config.ts
* Copyright (c)2014, by Olivier Evalet <evaleto@gmail.com>
* Licensed under GPL license (see LICENSE)
* TODO: WalletError
*/

import * as util from 'util';

export  class  Config {
  private stripeVersion:string;
  private isConfigured:boolean=false;
  private debug:boolean=false;
  private allowMaxAmount:number;
  private sandbox:boolean;
  private publickey:string;
  private privatekey:string;
  private apikey:string;
  private secret:string;
  private currency:string;
  private allowedCurrencies:string[];
  private allowMultipleSetOption:boolean;

  private static settings: any=new Config();

  private constructor() {
    this.stripeVersion = '2017-06-05';
    this.isConfigured=false;
    this.allowMaxAmount=1000.00; // block charge (payment) above
    this.sandbox = false;
    this.debug = false; // Enables *blocking* debug output to STDOUT

    // TODO: Set private and public key in parameters
    this.publickey='pk_test_Rdm8xRlYnL9jTbntvs9e788l'; // test key
    this.privatekey='sk_test_7v4G5a18JptIOX2cbYAYMsun'; // test key

    this.apikey='123456789';
    this.secret='walletapi';
    this.currency = 'CHF';
    this.allowedCurrencies = ['CHF'];
    this.allowMultipleSetOption = false;
  }

  static reset(){
    if(process.env.NODE_ENV=='test'){
      Config.settings.sandbox = false;
      Config.settings.currency = 'CHF';
      Config.settings.allowedCurrencies = ['CHF'];
      Config.settings.isConfigured=false;
    }
    else throw new Error('Reset is not possible here')
  }

  /**
 * ## debug(message)
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
  static debug(message: string){
    if (Config.settings.debug) {
      util.debug(message);
    }
  }

  /**
 * ## configure(opts)
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
  static configure(opts: any) {
    Config.debug('Configuring Wallet with: \n' + util.inspect(opts));
    if (!opts.apikey) {
      //throw new WalletError('system', 'Incomplete Wallet API credentials', opts);
      throw new Error('Incomplete Wallet API credentials');
    }
    Object.keys(opts).forEach(function(key) {
      Config.option(key, opts[key]);
    });
    Config.settings.isConfigured = true;
  }

  /**
 * ## option(name, [value])
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
  static option(option, value) {
    if (typeof value !== 'undefined') {
      Config.debug('Setting Wallet key `' + option + '` to `' + value.toString() + '`');

      // Do not allow an option to be set twice unless it's `currency`
      if (Config.settings.isConfigured &&
          !Config.settings.allowMultipleSetOption &&
          option !== 'currency') {
        /*throw new WalletError(
          'system',
          'Option ' + option + ' is already locked',
          option);*/
          throw new Error('Option is already locked');
      }

      switch (option) {
        case 'stripeVersion':
        case 'apikey':
        case 'currency':
        case 'secret':
        case 'publickey':
        case 'privatekey':
          Config.settings[option] = value;
        case 'allowMaxAmount':
          Config.settings[option] = parseFloat(value)
        case 'sandbox':
        case 'debug':
        case 'allowMultipleSetOption':
          Config.settings[option] = Boolean(value);
        case 'allowedCurrencies':
          if (!Array.isArray(value)) {
            //throw new WalletError('system', 'Allowed currencies must be an array', null);
            throw new Error('Allowed currencies must be an array');
          }
          if (value.indexOf(Config.settings.currency) < 0) {
            value.push(Config.settings.currency);
          }
          Config.settings[option] = value;
          break;
        default:
          // Do not allow unknown options to be set
          //throw new WalletError('system', 'Unrecognized configuration option', option);
          throw new Error('Unrecognized configuration option');
      }
    }
    return Config.settings[option];
  };

}
