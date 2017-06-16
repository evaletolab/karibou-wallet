"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util = require("util");
class Config {
    constructor() {
        this.isConfigured = false;
        this.debug = false;
        this.stripeVersion = '2017-06-05';
        this.isConfigured = false;
        this.allowMaxAmount = 1000.00;
        this.sandbox = false;
        this.debug = false;
        this.publickey = 'pk_test_Rdm8xRlYnL9jTbntvs9e788l';
        this.privatekey = 'sk_test_7v4G5a18JptIOX2cbYAYMsun';
        this.apikey = '123456789';
        this.secret = 'walletapi';
        this.currency = 'CHF';
        this.allowedCurrencies = ['CHF'];
        this.allowMultipleSetOption = false;
    }
    static reset() {
        if (process.env.NODE_ENV == 'test') {
            Config.settings.sandbox = false;
            Config.settings.currency = 'CHF';
            Config.settings.allowedCurrencies = ['CHF'];
            Config.settings.isConfigured = false;
        }
        else
            throw new Error('Reset is not possible here');
    }
    static debug(message) {
        if (Config.settings.debug) {
            util.debug(message);
        }
    }
    static configure(opts) {
        Config.debug('Configuring Wallet with: \n' + util.inspect(opts));
        if (!opts.apikey) {
            throw new Error('Incomplete Wallet API credentials');
        }
        Object.keys(opts).forEach(function (key) {
            Config.option(key, opts[key]);
        });
        Config.settings.isConfigured = true;
    }
    static option(option, value) {
        if (typeof value !== 'undefined') {
            Config.debug('Setting Wallet key `' + option + '` to `' + value.toString() + '`');
            if (Config.settings.isConfigured &&
                !Config.settings.allowMultipleSetOption &&
                option !== 'currency') {
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
                    break;
                case 'allowMaxAmount':
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
Config.settings = new Config();
exports.Config = Config;
//# sourceMappingURL=config.js.map