/**
* #config.ts
* Copyright (c)2014, by Olivier Evalet <evaleto@gmail.com>
* Licensed under GPL license (see LICENSE)
*/



export function nonEnumerableProperties(instance){
  Object.keys(instance).forEach(key => {
      if(key[0] === '_')
          Object.defineProperty(instance, key, { enumerable: false })
  })
}


export default class Config {

  private static settings: any;

  private constructor(opts) {

    Object.keys(opts).forEach(function(key) {
      Config.option(key, opts[key]);
      Object.defineProperty(Config.settings, key, { enumerable: false });
    });

    Config.settings.isConfigured = true;
  }

  // 
  // Only available for test 
  static reset(){
    if(process.env.NODE_ENV=='test'){
      Config.settings.allowMultipleSetOption=true;
    }
    else throw new Error('Reset is not possible here')
  }

  //
  // create Config instance with custom opts
  static configure(opts: any) {
    if(Config.settings) {
      return Config.settings;
    }

    Config.settings = { isConfigured : false };
    //
    // start with empty configuration
    if (!opts.apikey) {
      throw new Error('Incomplete Wallet API credentials');
    }
    return new Config(opts);
  }

  //
  //## option(name, [value])
  //*Returns or sets a single configuration option*
  static option(option:string, value?) {
    if (typeof value !== 'undefined') {

      // Do not allow an option to be set twice 
      if (Config.settings.isConfigured && !Config.settings.allowMultipleSetOption ) {
          throw new Error('Option is already locked');
      } 

      switch (option) {
        case 'stripeApiVersion':
        case 'stripePrivatekey':
        case 'grantSecret':
        case 'webhookSecret':
        case 'karibouApikey':
        case 'apikey':
        case 'provider':
        case 'currency':
        case 'secret':
        case 'shaSecret':
          Config.settings[option] = value;break;
        case 'allowMaxAmount':
        case 'allowMaxCredit':
        case 'reservedAmount':
            Config.settings[option] = parseFloat(value);break;
        case 'sandbox':
        case 'debug':
        case 'allowMultipleSetOption':
          Config.settings[option] = Boolean(value);break;
        case 'allowedCurrencies':
          if (!Array.isArray(value)) {
            throw new Error('Allowed currencies must be an array');
          }
          if (value.indexOf(Config.settings.currency) < 0) {
            value.push(Config.settings.currency);
          }
          Config.settings[option] = value;
          break;
        default:
          // Do not allow unknown options to be set
          throw new Error('Unrecognized configuration option');
      }
    }
    return Config.settings[option];
  };

}

