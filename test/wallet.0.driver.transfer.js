/**
 * unit tests for the main wallet module
 * psp error: http://docs.openstream.ch/payment-provider/wallet-error-messages/
 */

var assert = require('assert');
var should = require('should');
var dbtools = require('./fixtures/dbtools');
var db = require('mongoose');

describe("driver.mongoose.transfer", function(){
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

  var userWallet={
    wid:'wa_1234567890'
  };

  var giftWallet={
    id:'1111111',
    email:'giftcode@gg.com',
    description:'this is a wallet for customer',
    giftcode:true
  };

  var validTransfer={

  }


  it("Retrieve a customer wallet", function(done){
    this.timeout(2000);
    Wallets.retrieve(userWallet.wid).then(function (wallet) {
      setTimeout(function() {
        _.extend(userWallet,wallet)
        done();        
      }, 0);
    });
  });

  //
  // create a second walet that will be used as giftcode
  it("Create GIFTCODE wallet", function(done){
    this.timeout(2000);
    Wallets.create(giftWallet).then(function (wallet) {
      setTimeout(function() {
        _.extend(giftWallet,wallet)
        done();        
      }, 0);
    });
  });

  it("Check if recipients are differents (wallet to wallet)", function(done){
    var transfer={
      amount:400,
      wallet:giftWallet.wid,
      type:'debit',
    }
    Wallets.transfer_create(giftWallet.wid,transfer).then(undefined, function (error) {
      setTimeout(function() {
        error.message.should.equal('You have to specify a recipient different than your wallet')
        done()
      })
    });

  });


  it("Debit our empty GIFTCODE throw an error", function(done){
    var transfer={
      amount:400,
      type:'debit',
    }
    Wallets.transfer_create(giftWallet.wid,transfer).then(undefined, function (error) {
      setTimeout(function() {
        error.message.should.equal('Le montant sur votre compte est insuffisant !')
        done()
      });
    });

  });

  it("Credit our GIFTCODE with 4.00 CHF", function(done){
    var transfer={
      amount:400,
      type:'credit'
    }
    Wallets.transfer_create(giftWallet.wid,transfer).then(function (transfer,wallet) {
      setTimeout(function() {
        // console.log('------------',transfer)
        // console.log('------------',wallet)
        wallet.balance.should.equal(400)
        wallet.transfers.length.should.equal(1)
        done()
      });
    })
  });

  it("Debit our GIFTCODE with 4.00 CHF", function(done){
    var transfer={
      amount:200,
      wallet:userWallet.wid,
      type:'debit'
    }
    Wallets.transfer_create(giftWallet.wid,transfer).then(function (transfer,wallet) {
      setTimeout(function() {
        // console.log('------------',transfer)
        // console.log('------------',wallet)
        wallet.balance.should.equal(200)
        wallet.transfers.length.should.equal(2)
        done()
      });
    })
  });


  it("User register an existing GIFTCODE  ", function(done){
    var card={
      name:'User registration',
      number:giftWallet.card.number
    };



    Wallets.transferWallet(userWallet.wid,card).then(function (wallet) {
      setTimeout(function() {
        should.exist(wallet.card);
        should.exist(wallet.card.last4);
        wallet.wid.should.equal(userWallet.wid);
        wallet.card.last4.should.equal(userWallet.card.number.substr(16-4));
        done();
      });
    });
  });

  it("Credit our wallet with a giftcode", function(done){
    var card={
      name:'Paf Le chien',
      number:giftWallet.card.number,
      uid:1111112
    };

    Wallets.transferWallet(userWallet.wid,card).then(undefined, function (error) {
      setTimeout(function() {
        error.message.should.equal('The card can not be transfered')
        done();
      });
    });
  });  

  it("Credit our wallet with already credited giftcode ", function(done){
    var card={
      name:'Paf Le chien',
      number:giftWallet.card.number,
    };

    Wallets.transferWallet(userWallet.wid,card).then(undefined, function (error) {
      setTimeout(function() {
        error.message.should.equal('The card can not be transfered')
        done();
      });
    });
  });  


  it.skip("Cancel the previous transfert ", function(done){
  });

  
  it.skip("Transfer (DEBIT) current wallet to bank account", function(done){
  });


  it.skip("Select pending transfers", function(done){
  });

  it.skip("Select past transfers", function(done){
  });


  

});
