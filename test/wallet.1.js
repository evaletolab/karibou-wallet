/**
 * unit tests for the main wallet module
 * psp error: http://docs.openstream.ch/payment-provider/wallet-error-messages/
 */

var assert = require('assert');
var should = require('should');
var db = require('mongoose');
var dbtools = require('./fixtures/dbtools');

describe("wallet", function(){
  var config = require('../lib/config');
  var tools =require('../lib/tools');
  var karibou= require('../index');
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
    description:'this is a wallet for customer',
    giftcode:true
  };

  var userWallet={

  }


  it("Create a wallet verify fields", function(done){
    karibou.wallet.create(validWallet).then(function (wallet) {
      setTimeout(function() {
        should.not.exist(wallet.apikey);
        should.not.exist(wallet.__v);
        should.not.exist(wallet._id);
        should.not.exist(wallet.id);
        should.not.exist(wallet.signed_balance);
        should.not.exist(wallet.available);

        should.exist(wallet.wid);
        should.exist(wallet.email);
        should.exist(wallet.description);
        wallet.balance.should.equal(0);

        should.exist(wallet.card);
        // should.exist(wallet.card.number);
        should.exist(wallet.card.expiry);
        userWallet.wid=wallet.wid;
        userWallet.email=wallet.email;
        userWallet.card=wallet.card;
        done();        
      }, 0);
    });
  });

  //
  // create a second walet that will be used as giftcode
  it("Create GIFTCODE wallet", function(done){
    karibou.wallet.create(giftWallet).then(function (wallet) {
      setTimeout(function() {
        _.extend(giftWallet,wallet)
        done();        
      }, 0);
    });
  });

  it("Find GIFTCODE wallet by card", function(done){
    karibou.wallet.retrieveOneGift(giftWallet.card.number).then(function (wallet) {
      setTimeout(function() {
        wallet.wid.should.equal(giftWallet.wid)
        done();        
      }, 0);
    });
  });



  it.skip("Execute transaction with bogus card", function(done){
    done();
  });


});
