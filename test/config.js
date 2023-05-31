/**
 * Daimyo - unit tests for configuration module
 * Copyright (c)2011, by Branko Vukelic <branko@herdhound.com>
 * Licensed under MIT license (see LICENSE)
 */

 const assert = require('assert');
 const should = require('should');
 const config = require('../dist/config').default;
 const options = require('../config-test');
 config.configure(options.payment);


describe("config", function(){


  before(function(done){
    done()
  });


  after(function(done){
    config.reset();
    done()
  });  

  // START TESTING
  it("Initial state", function(done){
    should.exists(config.option);
    config.option('apikey').should.equal('123456789');
    config.option('currency').should.equal('CHF');
    config.option('stripeApiVersion').should.equal('2022-11-15');
    
    //config.option('enabled').should.equal(true);
    config.option('debug').should.equal(true);
    config.option('sandbox').should.equal(false);
    config.option('allowedCurrencies').should.not.be.empty;
    config.option('allowedCurrencies').should.containEql('CHF');
    config.option('allowMultipleSetOption').should.equal(true);
    done()
  });


  it("Configuration can't override settings", function(done){
    config.option({
      apikey: 'a1',
      allowMultipleSetOption: false // to prevent locking up settings
    });
    config.option('apikey').should.equal('123456789');

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
    config.option('allowMultipleSetOption',false);

    done()
  });

  it("Configuration is locked", function(done){
    try{
      config.option('allowMultipleSetOption',true);
      should.be.false(true);      
    }catch(err){}

    done()
  });

});
