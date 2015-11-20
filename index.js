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

module.exports = function(_conf) {
	if(_conf){
		config.configure(_conf);
	}
	return {
		configure:config.configure,
		option:config.option,
		wallet:new account.Wallet(),
		charge:new transaction.Transaction(),
		transfer:new transfer.Transfer()
	};
};
