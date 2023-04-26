/**
* #config.ts
* Copyright (c)2014, by Olivier Evalet <evaleto@gmail.com>
* Licensed under GPL license (see LICENSE)
*/
const fs = require('fs');


export default class Config {
  private stripeApiVersion:string;
  private stripePrivatekey:string;
  private debug:boolean=false;
  private allowMaxAmount:number;
  private sandbox:boolean;
  private apikey:string;
  private secret:string;
  private currency:string;
  private allowedCurrencies:string[];
  private allowMultipleSetOption:boolean;

  private static settings: any;

  private constructor(opts) {
    this.allowMaxAmount=1000.00; // block charge (payment) above
    this.sandbox = false;
    this.debug = false; // Enables *blocking* debug output to STDOUT    
    this.allowMultipleSetOption = false;

    Object.keys(opts).forEach(function(key) {
      Config.option(key, opts[key]);
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
        case 'karibouApikey':
        case 'apikey':
        case 'currency':
        case 'secret':
        case 'shaSecret':
          Config.settings[option] = value;break;
        case 'allowMaxAmount':
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

const env = (process.env.NODE_ENV || 'test')
, path = require('path')
, rootPath = path.normalize(__dirname + '/..')  
, test=(env==='test')?'-test':'';

//
// dynamic position      
let cfg;

// try load environment specific config
if(fs.existsSync(__dirname+'/config-'+ env+'.js')){
  cfg = '../config-'+ env;  
}else if(env==='production'){
  cfg = '../config-production';
}else{      
  cfg = '../config-' + env;
}


//
// make the configuration visible  
const config = require(cfg);
console.log(' load configuration for payment module using: ',cfg);
export const $config = Config.configure(config.wallet||config.payment);

