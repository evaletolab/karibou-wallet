/**
 * unit tests for the main wallet module
 * psp error: http://docs.openstream.ch/payment-provider/wallet-error-messages/
 */

var assert = require('assert');
var should = require('should');
var dbtools = require('./fixtures/dbtools');
var db = require('mongoose');

describe("driver.mongoose.transaction", function(){
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

  var capturedTrans={

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

  it("Creating new transaction with charge above the limit", function(done){
    var transaction={
      amount:1800,
      description:'hello'
    }
    Wallets.transaction_charge(userWallet.wid,transaction).then(undefined,function (error) {
      setTimeout(function() {
        error.message.should.containEql('Les transactions sont limitées')
        done();
      });
    })
  });


  it("Creating new transaction with amount above the balance", function(done){
    var transaction={
      amount:800,
      description:'hello'
    }
    Wallets.transaction_charge(userWallet.wid,transaction).then(undefined,function (error) {
      setTimeout(function() {
        error.message.should.equal('Le montant sur votre compte est insuffisant !')
        done();
      });
    })
  });

  it("Creating a valid transaction with status captured", function(done){
    var trans={
      amount:100,
      description:'hello',
      captured:true
    }
    Wallets.transaction_charge(userWallet.wid,trans).then(function (transaction) {
      var wallet=transaction._data.wallet;
      setTimeout(function() {
        _.extend(capturedTrans,transaction);
        should.exist(transaction.description);
        should.exist(transaction.created);
        transaction.description.should.equal(trans.description)
        transaction.status.should.equal('capture')
        transaction.amount.should.equal(trans.amount)
        transaction.id.substr(0,3).should.equal('ch_');
        should.exist(wallet)
        wallet.balance.should.equal(400)
        done();
      });
    })
  });

  it("Capture transaction with status captured", function(done){
    var transaction={
      amount:100,id:capturedTrans.id
    }
    Wallets.transaction_capture(userWallet.wid,transaction).then(undefined, function (error) {
      setTimeout(function() {
        error.message.should.containEql('Impossible de capturer une transaction avec le status')
        done();
      });
    })
  });

  it("Cancel transaction with status captured", function(done){
    var transaction={
      id:capturedTrans.id
    }
    Wallets.transaction_cancel(userWallet.wid,transaction).then(undefined, function (error) {
      setTimeout(function() {
        error.message.should.containEql('Impossible de capturer une transaction avec le status')
        done();
      });
    })
  });


  it("Refund transaction with amount above the captured", function(done){
    var transaction={
      amount:2000,id:capturedTrans.id
    }
    Wallets.transaction_refund(userWallet.wid,transaction).then(undefined,function (error) {
      setTimeout(function() {
        error.message.should.containEql('Le montant remboursé ne peut pas dépasser')
        done();
      });
    })
  });

  it("Refund captured transaction ", function(done){
    var transaction={
      amount:50,id:capturedTrans.id
    }
    Wallets.transaction_refund(userWallet.wid,transaction).then(function (trans) {
      var wallet=trans._data.wallet;
      setTimeout(function() {
        trans.logs[0].should.containEql('refund 0.5 CHF at')
        trans.id.should.equal(transaction.id);
        trans.amount.should.equal(100);
        trans.amount_refunded.should.equal(50);
        should.exist(wallet)
        wallet.balance.should.equal(450)

        Wallets.retrieve(userWallet.wid).then(function (wallet) {
          wallet.balance.should.equal(450);
          userWallet.balance.should.equal(500)
          done();
        });
      });
    })
  });

  it("Creating a valid transaction with status authorised", function(done){
    var trans={
      amount:400,
      description:'hello'
    }
    Wallets.transaction_charge(userWallet.wid,trans).then(function (transaction) {
      var wallet=transaction._data.wallet;
      setTimeout(function() {
        _.extend(capturedTrans,transaction);
        transaction.status.should.equal('authorize')
        transaction.amount.should.equal(trans.amount)
        should.exist(wallet)
        wallet.balance.should.equal(450)
        //
        // wallet amount should be unchanged
        Wallets.retrieve(userWallet.wid).then(function (wallet) {
          wallet.balance.should.equal(450);
          done();
        });
      });
    })
  });

  it("Creating a transaction with negative amount ", function(done){
    var transaction={
      amount:-100,
      description:'Hohoho'
    }
    Wallets.transaction_charge(userWallet.wid,transaction).then(undefined, function (error) {
      setTimeout(function() {
        error.message.should.containEql('Le montant n\'est pas valide')
        done();
      });
    })
  });

  it("Creating a transaction with amount in wallet is insufficient", function(done){
    var transaction={
      amount:100,
      description:'Hohoho'
    }
    Wallets.transaction_charge(userWallet.wid,transaction).then(undefined, function (error) {
      setTimeout(function() {
        error.message.should.containEql('Le montant sur votre compte est insuffisant')
        done();
      });
    })
  });


  it("Refund transaction with status authorised", function(done){
    var transaction={
      id:capturedTrans.id
    }
    Wallets.transaction_refund(userWallet.wid,transaction).then(undefined, function (error) {
      setTimeout(function() {
        error.message.should.containEql('Impossible de capturer une transaction avec le status')
        done();
      });
    })
  });

  it("Capture transaction with amount bellow the authorised", function(done){
    var transaction={
      amount:50,id:capturedTrans.id
    }
    Wallets.transaction_capture(userWallet.wid,transaction).then(function (trans) {
      var wallet=trans._data.wallet;
      setTimeout(function() {
        trans.status.should.equal('capture')
        trans.amount.should.equal(trans.amount)
        should.exist(wallet)
        wallet.balance.should.equal(400)

        //
        // wallet amount should be unchanged
        Wallets.retrieve(userWallet.wid).then(function (wallet) {
          wallet.balance.should.equal(400);
          done();
        });
      });
    })
  });


  

});
