/**
 * Postfinance - main module
 * Copyright (c)2014, by Olivier Evalet <evaleto@gmail.com>
 * Copyright (c)2011, by Branko Vukelic <branko@herdhound.com>
 * Licensed under GPL license (see LICENSE)
 */

var account = require('./lib/wallet');
var transaction = require('./lib/wallet.transaction');
var transfer = require('./lib/wallet.transfer');
var config = require('./lib/config');
var check = require('./lib/check');

exports.configure = config.configure;
exports.option = config.option;
exports.wallet = new account.Wallet();
exports.charge = new transaction.Transaction();
exports.transfer = new transfer.Transfer();
