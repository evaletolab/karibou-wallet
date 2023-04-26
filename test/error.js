/**
 * postfinance - unit tests for configuration module
 * Copyright (c)2014, by Olivier Evalet <evaleto@gmail.com>
 * Copyright (c)2011, by Branko Vukelic <branko@herdhound.com>
 * Licensed under GPL license (see LICENSE)
 */

 const config =require("../dist/config").default;
 const payments = require("../dist/payments");
 const should = require('should');
 


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
