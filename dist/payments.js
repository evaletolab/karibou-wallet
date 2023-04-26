"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unxor = exports.xor = exports.dateFromExpiry = exports.readExpiry = exports.normalizeYear = exports.parseYear = exports.$stripe = exports.Payment = void 0;
const config_1 = require("./config");
const stripe_1 = require("stripe");
var Payment;
(function (Payment) {
    Payment[Payment["card"] = 1] = "card";
    Payment[Payment["sepa"] = 2] = "sepa";
    Payment[Payment["balance"] = 3] = "balance";
    Payment[Payment["bitcoin"] = 4] = "bitcoin";
})(Payment = exports.Payment || (exports.Payment = {}));
exports.$stripe = new stripe_1.default(config_1.default.option('stripePrivatekey'), {
    apiVersion: config_1.default.option('stripeApiVersion'),
    maxNetworkRetries: 2
});
const parseYear = function (year) {
    if (!year) {
        return;
    }
    let yearVal;
    year = parseInt(year, 10);
    if (year < 10) {
        yearVal = this.normalizeYear(10, year);
    }
    else if (year >= 10 && year < 100) {
        yearVal = this.normalizeYear(100, year) - 2000;
    }
    else if (year >= 2000 && year < 2050) {
        yearVal = parseInt(year) - 2000;
    }
    else {
        yearVal = year;
    }
    return yearVal + 2000;
};
exports.parseYear = parseYear;
const normalizeYear = function (order, year) {
    return (Math.floor(new Date().getFullYear() / order) * order) + year;
};
exports.normalizeYear = normalizeYear;
const readExpiry = function (expiryStr) {
    if (expiryStr === undefined)
        return;
    var expiry = expiryStr.split('/'), year = this.parseYear(expiry[1]), month = parseInt(expiry[0]);
    if (isNaN(month) || year === undefined || year > 2050 || year < 2000 || month < 1 || month > 12) {
        return;
    }
    return [year, month];
};
exports.readExpiry = readExpiry;
const dateFromExpiry = function (expiryStr) {
    var expiry = this.readExpiry(expiryStr);
    if (expiry && expiry.length) {
        return new Date(expiry[0], expiry[1], 0, 23, 59, 0, 0);
    }
};
exports.dateFromExpiry = dateFromExpiry;
const xor = function (text, pkey) {
    pkey = pkey || config_1.default.option('shaSecret');
    const data = Uint8Array.from(Array.from(text).map(char => char.charCodeAt(0)));
    const key = Uint8Array.from(Array.from(pkey).map(char => char.charCodeAt(0)));
    const uint8 = data.map((digit, i) => {
        return (digit ^ keyNumberAt(key, i));
    });
    return Buffer.from(uint8).toString('hex');
};
exports.xor = xor;
const unxor = function (hex, pkey) {
    pkey = pkey || config_1.default.option('shaSecret');
    const text = Buffer.from(hex, 'hex').toString();
    const data = Uint8Array.from(Array.from(text).map(char => char.charCodeAt(0)));
    const key = Uint8Array.from(Array.from(pkey).map(char => char.charCodeAt(0)));
    const uint8 = data.map((digit, i) => {
        return (digit ^ keyNumberAt(key, i));
    });
    return Buffer.from(uint8).toString();
};
exports.unxor = unxor;
function keyNumberAt(key, i) {
    return key[Math.floor(i % key.length)];
}
//# sourceMappingURL=payments.js.map