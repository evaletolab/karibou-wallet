/**
 * unit tests for the main wallet module
 * psp error: http://docs.openstream.ch/payment-provider/wallet-error-messages/
 */

var assert = require('assert');
var should = require('should');
var dbtools = require('./fixtures/dbtools');
var db = require('mongoose');

//
// credit could be authorized on a wallet
// with the field amount_negative
describe("driver.mongoose.transaction.credit", function(){
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


  var giftWallet={
    id:'1111111',
    email:'giftcode@gg.com',
    description:'this is a wallet for customer',
    giftcode:true
  };

  var userWallet={
    id:'2222222',
    email:'test@gg.com',
    description:'this is a wallet for customer',
    amount_negative:100
  };

  var noNegativeWallet={
    id:'1111112'
  };

  var capturedTrans={

  }


  it("Retrieve a customer wallet", function(done){
    this.timeout(2000);
    Wallets.create(userWallet).then(function (wallet) {
      setTimeout(function() {
        _.extend(userWallet,wallet)
        done();        
      }, 0);
    });
  });

  it("Retrieve a customer wallet without amount_negative", function(done){
    this.timeout(2000);
    Wallets.create(userWallet).then(function (wallet) {
      setTimeout(function() {
        _.extend(noNegativeWallet,wallet)
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

  it("Creating new transaction with amount above the balance", function(done){
    var transaction={
      amount:101,
      description:'hello'
    }
    Wallets.transaction_charge(userWallet.wid,transaction).then(undefined,function (error) {
      setTimeout(function() {
        error.message.should.equal('Le montant sur votre compte est insuffisant !')
        done();
      });
    })
  });

  it("Creating new transaction with amount above the balance (in noNegativeWallet)", function(done){
    var transaction={
      amount:1000,
      description:'hello'
    }
    Wallets.transaction_charge(noNegativeWallet.wid,transaction).then(undefined,function (error) {
      setTimeout(function() {
        error.message.should.equal('Le montant sur votre compte est insuffisant !')
        done();
      });
    })
  });


  it("Creating a valid transaction with status captured ", function(done){
    var trans={
      amount:100,
      description:'hello',
      captured:true
    }
    Wallets.transaction_charge(userWallet.wid,trans).then(function (transaction) {
      setTimeout(function() {
        _.extend(capturedTrans,transaction);
        transaction.status.should.equal('capture')
        transaction.amount.should.equal(trans.amount)
        done();
      });
    }).then(undefined,function (err) {
      console.log('---------------',err)
      // body...
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



  it("Refund captured transaction ", function(done){
    var transaction={
      amount:50,id:capturedTrans.id
    }
    Wallets.transaction_refund(userWallet.wid,transaction).then(function (trans) {
      setTimeout(function() {
        trans.logs[0].should.containEql('refund 0.5 CHF at')
        trans.id.should.equal(transaction.id);
        trans.amount.should.equal(100);
        trans.amount_refunded.should.equal(50);
        Wallets.retrieve(userWallet.wid).then(function (wallet) {
          setTimeout(function() {
            // console.log(wallet)
            wallet.balance.should.equal(-50);
            userWallet.balance.should.equal(0)
            done();

          });
        })
      });
    })
  });


  

});
