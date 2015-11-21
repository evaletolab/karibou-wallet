/**
 * unit tests for the main wallet module
 * psp error: http://docs.openstream.ch/payment-provider/wallet-error-messages/
 */

var assert = require('assert');
var should = require('should');
var dbtools = require('./fixtures/dbtools');
var db = require('mongoose');

describe("driver.mongoose.wallet", function(){
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


  it("Create a wallet verify fields", function(done){
    this.timeout(2000);
    Wallets.create(validWallet).then(function (wallet) {
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

  it("Create multiple private wallet for a customer (ERROR)", function(done){
    this.timeout(2000);
    Wallets.create(validWallet).then(function (wallet) {
      setTimeout(function() {
        should.not.exist(wallet)
      }, 0);
    }).then(undefined,function (err) {
        err.message.should.containEql('Impossible de créer un comtpe pour cet utilisateur')
        done();        
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


  it("Update wallet protected field should not be updated", function(done){
    var update={
      wid:'new',
      id:'1111',
      balance:100000,
      expiry:'01/2017',
      name:'olivier truc l\'chôsé',
      external_account:{
        iban:'BE68539007547034',
        name:'Paf Le chien'
      }
    }

    Wallets.update(userWallet.wid,update).then(function (wallet) {
      setTimeout(function() {
        should.not.exist(wallet.id)
        wallet.wid.should.equal(userWallet.wid)
        should.exist(wallet.card)
        wallet.card.expiry.getTime().should.equal(new Date(userWallet.card.expiry).getTime())
        wallet.balance.should.equal(0)
        wallet.card.name.should.equal('olivier-truc-lchose')
        done();
      }, 10);
    });
  });

  it("Update wallet with wrong expiry", function(done){
    var update={
      expiry:'15/2017'
    }
    Wallets.updateExpiry(userWallet.wid,update).then(undefined, function (error) {
      setTimeout(function() {
        should.exist(error);
        error.message.should.containEql('La date n\'est pas valide')
        done();
      },0);
    });
  });

  it("Update wallet with wrong expiry", function(done){
    var update={
      expiry:'11/1017'
    }
    Wallets.updateExpiry(userWallet.wid,update).then(undefined, function (error) {
      setTimeout(function() {
        should.exist(error);
        error.message.should.containEql('La date n\'est pas valide')
        done();
      },0)
    });
  });

  it("Update wallet with good expiry", function(done){
    var update={
      expiry:'2/2017',
    }
    Wallets.updateExpiry(userWallet.wid,update).then(function (wallet) {
      setTimeout(function() {
        wallet.card.expiry.getTime().should.equal(tools.dateFromExpiry(update.expiry).getTime())
        done();
      },0)
    });
  });

  it("Update wallet with wrong IBAN number", function(done){
    var update={
      external_account:{
        iban:'test',
        name:'Paf Le chien'
      }
    }
    Wallets.update(userWallet.wid,update).then(undefined, function (error) {
      setTimeout(function() {
        should.exist(error);
        error.message.should.equal('La référence IBAN n\'est pas valide')
        done();
      },0);
    });
  });


  it("Update wallet with bad apikey ", function(done){
    var update={
      expiry:'01/2017'
    }, apikey=config.option('apikey');

    config.option('apikey','abcd');
    Wallets.update(userWallet.wid,update).then(undefined, function (error) {
      setTimeout(function() {
        error.message.should.equal('This wallet does not belongs to this instance')
        config.option('apikey',apikey)
        done();
      },0);
    });
  });

  it("Register wrong card  ", function(done){
    var card={
      name:'Paf Le chien',
      number:12345,
      uid:12345
    };

    Wallets.transferGiftcode(userWallet.wid,card).then(undefined, function (error) {
      setTimeout(function() {
        error.message.should.equal('The wallet does not exist')
        done();
      });
    },0);
  });


  it("Creating new transaction using an empty wallet", function(done){
    var transaction={
      amount:200,
      description:'hello'
    }
    Wallets.transaction_charge(userWallet.wid,transaction).then(undefined,function (error) {
      setTimeout(function() {
        error.message.should.equal('Le montant sur votre compte est insuffisant !')
        done();
      },0);
    })
  });


  it.skip("Execute transaction with bogus card", function(done){
    done();
  });


});
