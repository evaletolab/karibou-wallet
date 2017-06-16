/**
 * unit tests for the main wallet module
 * psp error: http://docs.openstream.ch/payment-provider/wallet-error-messages/
 */

var assert = require('assert');
var should = require('should');
var dbtools = require('./fixtures/dbtools');
var db = require('mongoose');

describe.skip("wallet.transaction", function(){
  var config = require('../lib/config');
  var tools=require('../lib/tools');
  var karibou= require('../index')();
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
    karibou.wallet.retrieve(userWallet.wid).then(function (wallet) {
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
    karibou.wallet.create(giftWallet).then(function (wallet) {
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
    karibou.charge.create(userWallet.wid,transaction).then(undefined,function (error) {
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
    karibou.charge.create(userWallet.wid,transaction).then(undefined,function (error) {
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
    karibou.charge.create(userWallet.wid,trans).then(function (transaction,w) {
      setTimeout(function() {
        _.extend(capturedTrans,transaction);
        transaction.id.substr(0,3).should.equal('ch_');
        done();
      });
    })
  });

  it("Capture transaction with status captured", function(done){
    var transaction={
      amount:100,id:capturedTrans.id
    }
    karibou.charge.capture(userWallet.wid,transaction).then(undefined, function (error) {
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
    karibou.charge.cancel(userWallet.wid,transaction).then(undefined, function (error) {
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
    karibou.charge.refund(userWallet.wid,transaction).then(undefined,function (error) {
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
    karibou.charge.refund(userWallet.wid,transaction).then(function (trans) {
      setTimeout(function() {
        karibou.wallet.retrieve(userWallet.wid).then(function (wallet) {
          wallet.balance.should.equal(450);
          userWallet.balance.should.equal(500)
          done();
        });
      });
    })
  });


  it("Re-Refund captured transaction is currently not authorised", function(done){
    var transaction={
      amount:40,id:capturedTrans.id
    }
    karibou.charge.refund(userWallet.wid,transaction).then(undefined,function (err) {
      setTimeout(function () {
        err.message.should.equal('Impossible de capturer une transaction avec le status refund')
        done();
      })
    })
  });

  it("Get transaction details ", function(done){
    karibou.transaction.info(userWallet.wid,capturedTrans.id).then(function (trans) {

      setTimeout(function() {
        should.not.exist(trans._id);
        trans.status.should.equal('refund');
        done();
      });
    })
  });


  it("Creating a valid transaction with status authorised", function(done){
    var trans={
      amount:400,
      description:'hello'
    }
    karibou.charge.create(userWallet.wid,trans).then(function (transaction) {
      setTimeout(function() {
        _.extend(capturedTrans,transaction);
        transaction.status.should.equal('authorize')
        transaction.amount.should.equal(trans.amount)
        //
        // wallet amount should be unchanged
        karibou.wallet.retrieve(userWallet.wid).then(function (wallet) {
          wallet.balance.should.equal(450);
          done();
        });
      });
    })
  });

  it("Creating a transaction will amount in wallet is insufficient", function(done){
    var transaction={
      amount:100,
      description:'Hohoho'
    }
    karibou.charge.create(userWallet.wid,transaction).then(undefined, function (error) {
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
    karibou.charge.refund(userWallet.wid,transaction).then(undefined, function (error) {
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
    karibou.charge.capture(userWallet.wid,transaction).then(function (trans) {
      setTimeout(function() {
        trans.status.should.equal('capture')
        trans.amount.should.equal(trans.amount)
        //
        // wallet amount should be unchanged
        karibou.wallet.retrieve(userWallet.wid).then(function (wallet) {
          wallet.balance.should.equal(400);
          done();
        });
      });
    })
  });




});
