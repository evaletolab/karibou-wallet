/**
 * postfinance - unit tests for configuration module
 * Copyright (c)2014, by Olivier Evalet <evaleto@gmail.com>
 * Copyright (c)2011, by Branko Vukelic <branko@herdhound.com>
 * Licensed under GPL license (see LICENSE)
 */

var config = require('../lib/config');
var WalletError = require('../lib/error');
var helpers = require('./fixtures/helpers');
var assert = require('assert');
var should = require('should');
var test = exports;



describe.skip("error", function(){


  before(function(done){
    done()
  });


  it("local WalletError", function(done){
    var error=new WalletError(
      'system',
      'Currency not allowed',
      '$'
    )
    error.message.should.containEql('Currency not allowed')
    done()
  });
});
