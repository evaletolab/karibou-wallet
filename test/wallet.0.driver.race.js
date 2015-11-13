/**
 * unit tests for the main wallet module
 * psp error: http://docs.openstream.ch/payment-provider/wallet-error-messages/
 */

var assert = require('assert');
var should = require('should');
var dbtools = require('./fixtures/dbtools');
var db = require('mongoose');
var Q=require('q');

describe("driver.mongoose.race.wallet", function(){
  var config = require('../lib/config');
  require('../lib/wallet.driver.mongoose.js');
  var Wallets=db.model('Wallets');
  var tools=require('../lib/tools');
  var _=require('underscore');

  before(function(done){
    db.connect(config.option('mongo').name, function () {
      dbtools.load(["../fixtures/Wallets.js"],db,done);
    });
  });

  after(function (done) {
    dbtools.clean(done);
  });

  var validWallet={
    id:'2222222',
    email:'test@gg.com',
    description:'this is a wallet for customer'
  };

  var giftWallet={
    id:'1111111',
    email:'giftcode@gg.com',
    description:'this is a wallet for customer'
  };

  var userWallet={

  }


  it("Create a race wallet verify wid", function(done){
    this.timeout(2000);
    var races=[], wids={};
    races.push(Wallets.create(validWallet));
    races.push(Wallets.create(validWallet));
    races.push(Wallets.create(validWallet));
    races.push(Wallets.create(giftWallet));


    Q.all(races).then(function (wallets) {
      wallets.forEach(function (w) {
        wids[w.wid]=w;
      })
      Object.keys(wids).length.should.equal(4);
      done();
    });

  });


});
