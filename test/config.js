/**
 * Daimyo - unit tests for configuration module
 * Copyright (c)2011, by Branko Vukelic <branko@herdhound.com>
 * Licensed under MIT license (see LICENSE)
 */

var config = require('../dist/config').Config;
var helpers = require('./fixtures/helpers');
var assert = require('assert');
var should = require('should');
var test = exports;

// Set up fixtures
var testKeyBases = ['key1', 'key2', 'key3'];
var testKeys = [];
var badKeys = ['bogus', 'foo', '123'];

// Generate some dummy keys
testKeyBases.forEach(function(base) {
  testKeys.push(helpers.generateKey(base));
});

describe("config", function(){


  before(function(done){
    done()
  });

  // START TESTING
  it("Initial state", function(done){
    config.should.property('option');
    config.option('apikey').should.equal('123456789');
    config.option('currency').should.equal('CHF');
    config.option('publickey').should.equal('pk_test_Rdm8xRlYnL9jTbntvs9e788l');
    config.option('privatekey').should.equal('sk_test_7v4G5a18JptIOX2cbYAYMsun');
    //config.option('enabled').should.equal(true);
    config.option('isConfigured').should.equal(false);
    config.option('debug').should.equal(false);
    config.option('sandbox').should.equal(false);
    config.option('allowedCurrencies').should.not.be.empty;
    config.option('allowedCurrencies').should.containEql('CHF');
    //config.option('allowMultipleSetOption').should.equal(false);
    done()
  });

  it("Configuration requires all three keys", function(done){
    assert.throws(function() {
      config.configure({allowMultipleSetOption:true});
    });

    assert.throws(function() {
      config.configure({
        apiPassword: testKeys[1],
        apiUser: testKeys[2]
      });
    });

    assert.throws(function() {
      config.configure({
        pspid: testKeys[0],
        apiUser: testKeys[2]
      });
    });

    done()
  });


  it("Proper configuration modifies settings correctly", function(done){
    config.configure({
      apikey: testKeys[0],
      allowMultipleSetOption: true // to prevent locking up settings
    });
    config.option('apikey').should.equal(testKeys[0]);
    done()
  });

  it("Setting individual configuration options", function(done){

    config.option('debug', false);
    config.option('debug', true);
    config.option('debug').should.equal(true);

    config.option('debug', false);
    config.option('debug', 'yes'); // truthy
    config.option('debug').should.equal(true);
    config.option('debug', false);

    config.option('currency', 'CHF');
    config.option('currency', 'JPY');
    config.option('currency').should.equal('JPY');

    config.option('sandbox', 'yes'); // truthy
    config.option('sandbox').should.equal(true);

    config.option('allowedCurrencies', ['GBP']);
    config.option('allowedCurrencies').should.containEql('GBP');
    config.option('allowedCurrencies').should.containEql('JPY'); // includes default

    config.option('allowedCurrencies', []);
    config.option('allowedCurrencies').should.not.be.empty;
    config.option('allowedCurrencies').should.containEql('JPY');
    
    done()
  });

});
