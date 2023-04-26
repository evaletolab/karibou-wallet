"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.$config = void 0;
const fs = require('fs');
class Config {
    constructor(opts) {
        this.debug = false;
        this.allowMaxAmount = 1000.00;
        this.sandbox = false;
        this.debug = false;
        this.allowMultipleSetOption = false;
        Object.keys(opts).forEach(function (key) {
            Config.option(key, opts[key]);
        });
        Config.settings.isConfigured = true;
    }
    static reset() {
        if (process.env.NODE_ENV == 'test') {
            Config.settings.allowMultipleSetOption = true;
        }
        else
            throw new Error('Reset is not possible here');
    }
    static configure(opts) {
        if (Config.settings) {
            return Config.settings;
        }
        Config.settings = { isConfigured: false };
        if (!opts.apikey) {
            throw new Error('Incomplete Wallet API credentials');
        }
        return new Config(opts);
    }
    static option(option, value) {
        if (typeof value !== 'undefined') {
            if (Config.settings.isConfigured && !Config.settings.allowMultipleSetOption) {
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
                    Config.settings[option] = value;
                    break;
                case 'allowMaxAmount':
                case 'reservedAmount':
                    Config.settings[option] = parseFloat(value);
                    break;
                case 'sandbox':
                case 'debug':
                case 'allowMultipleSetOption':
                    Config.settings[option] = Boolean(value);
                    break;
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
                    throw new Error('Unrecognized configuration option');
            }
        }
        return Config.settings[option];
    }
    ;
}
exports.default = Config;
const env = (process.env.NODE_ENV || 'test'), path = require('path'), rootPath = path.normalize(__dirname + '/..'), test = (env === 'test') ? '-test' : '';
let cfg;
if (fs.existsSync(__dirname + '/config-' + env + '.js')) {
    cfg = '../config-' + env;
}
else if (env === 'production') {
    cfg = '../config-production';
}
else {
    cfg = '../config-' + env;
}
const config = require(cfg);
console.log(' load configuration for payment module using: ', cfg);
exports.$config = Config.configure(config.wallet || config.payment);
//# sourceMappingURL=config.js.map