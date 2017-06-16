/**
 * unit tests for the main wallet module
 * psp error: http://docs.openstream.ch/payment-provider/wallet-error-messages/
 */

var assert = require('assert');
var should = require('should');
var dbtools = require('./fixtures/dbtools');
var db = require('mongoose');

describe.skip("driver.mongoose.race.transaction", function(){
  var config = require('../lib/config');
  require('../lib/wallet.driver.mongoose.js');
  var Wallets=db.model('Wallets');
  var tools=require('../lib/tools');
  var _=require('underscore');
  var Q=require('q');

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

  it("Create and load wallets ", function(done){
    this.timeout(2000);
    Wallets.retrieve(userWallet.wid).then(function (wallet) {
      _.extend(userWallet,wallet);
      return Wallets.create(giftWallet);
    }).then(function (wallet) {
      _.extend(giftWallet,wallet);
      done();
    });

  });

  it("Try double transaction with status captured", function(done){
    var trans={
      amount:300,
      description:'hello',
      captured:true
    }
    var races=[], wids={};
    races.push(Wallets.transaction_charge(userWallet.wid,trans));
    races.push(Wallets.transaction_charge(userWallet.wid,trans));

    Q.all(races).then(function (trx,wallet) {
      should.not.exist(trx);
    }).then(undefined,function (error) {
      error.message.should.containEql('The wallet is already running another task')
      done();
    });


  });

  it("Verify wallet balance", function(done){
      Wallets.retrieve(userWallet.wid).then(function (wallet) {
        wallet.balance.should.equal(200);
        userWallet.balance.should.equal(500)
        done();
      });
  });


  it("verify that wallet lock is well released", function(done){
    var trans={
      amount:30,
      description:'hello',
      captured:true
    }

    Wallets.transaction_charge(userWallet.wid,trans).then(function (trx,wallet) {
      setTimeout(function() {
        should.exist(trx);
        wallet.balance.should.equal(500-300-30)
        done();
      }, 0);
    });


  });

  // we loose the tr.id before
  it.skip("Refund 2 times the same captured transaction ", function(done){
    var transaction={
      amount:280,id:capturedTrans.id
    }
    var races=[], wids={};
    races.push(Wallets.transaction_refund(userWallet.wid,transaction));
    races.push(Wallets.transaction_refund(userWallet.wid,transaction));

    Q.all(races).then(function (trx) {
      setTimeout(function() {
        should.not.exist(trx);
      }, 10);
    }).then(undefined,function (error) {
      setTimeout(function() {
        error.message.should.containEql('The wallet is already running another task')

        Wallets.retrieve(userWallet.wid).then(function (wallet) {
          wallet.balance.should.equal(480);
          userWallet.balance.should.equal(500)
          done();
        });
      }, 10);
    });

  });


});
