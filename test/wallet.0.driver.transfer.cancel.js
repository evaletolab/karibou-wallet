/**
 * unit tests for the main wallet module
 * psp error: http://docs.openstream.ch/payment-provider/wallet-error-messages/
 */

var assert = require('assert');
var should = require('should');
var dbtools = require('./fixtures/dbtools');
var db = require('mongoose');

describe("driver.mongoose.transfer.cancel", function(){
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
  },

  otherWallet={
    wid:'wa_1234567891'
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
        // console.log('-----------------user',wallet.email,wallet.balance);
        done();        
      }, 0);
    });
  });

  it("Retrieve other wallet", function(done){
    this.timeout(2000);
    Wallets.retrieve(otherWallet.wid).then(function (wallet) {
      setTimeout(function() {
        _.extend(otherWallet,wallet)
        // console.log('-----------------other',wallet.email,wallet.balance);
        done();        
      }, 0);
    });
  });

  it("Credit user wallet from other wallet is ILLEGAL ", function(done){
    var transfer={
      amount:100,
      refid:'order 0123456',
      description:'commande truc ',
      type:'credit'
    }; 

    Wallets.transfer_create(userWallet.wid,transfer,otherWallet.wid).then(undefined,function (err) {
      setTimeout(function() {
        err.message.should.containEql('La provenance bancaire de votre transfert')
        done()
      });
    })    
  });


  it("Credit our wallet from BANK ", function(done){
    //
    // CCP 11-117212-4
    // CH3009000000+11-117212-4
    // CH3009000000111172124
    // wallet = 700 + tranfer 200
    var transfer={
      amount:200,
      refid:'KOBE151116886203',
      description:'VIREMENT DU COMPTE 11-117212-4 BIO PAUL, TITULAIRE DUMIN RUE DE LA BOULANGERIE 3 1204 ',
      type:'credit'
    }; 
    var bank={
      iban:'CH3009000000111172124',
      name:'TITULAIRE DUMIN RUE DE LA BOULANGERIE 3 1204',
    };

    Wallets.transfer_create(userWallet.wid,transfer,bank).then(function (transfer) {
      var wallet=transfer._data.wallet;
      setTimeout(function() {
        _.extend(validTransfer,transfer);
        should.exist(transfer.id)
        should.exist(transfer.bank.name)
        transfer.amount.should.equal(200);
        transfer.bank.iban.should.equal('CH3009000000111172124')
        transfer.refid.should.equal('KOBE151116886203')
        wallet.balance.should.equal(700)
        wallet.transfers.length.should.equal(1)
        done()
      });
    })    

  });  

  it("Cancel part (1 CHF) of the previous BANK transfert ", function(done){
    var cancel={
      id:validTransfer.id,
      amount:100
    }
    Wallets.transfer_cancel(userWallet.wid,cancel).then(function (transfer,wallet,recipient) {
      var wallet=transfer._data.wallet;
      setTimeout(function() {
        should.exist(transfer.id)
        should.exist(transfer.bank.name)
        transfer.amount_reversed.should.equal(100);
        transfer.reversed.should.equal(true);
        transfer.bank.iban.should.equal('CH3009000000111172124')
        transfer.refid.should.equal('KOBE151116886203')
        wallet.balance.should.equal(600)
        wallet.transfers.length.should.equal(1)
        done()
      });
    })    
  });

  it("Cancel more than the previous BANK transfert ", function(done){
    var cancel={
      id:validTransfer.id,
      amount:100.01
    }
    Wallets.transfer_cancel(userWallet.wid,cancel).then(undefined, function (err) {
      setTimeout(function() {
        err.message.should.containEql('Le montant remboursé ne peut pas dépasser la valeur original')
        done()
      });
    })    
  });

  it("Cancel total of the previous BANK transfert ", function(done){
    var cancel={
      id:validTransfer.id,
      amount:100
    }
    Wallets.transfer_cancel(userWallet.wid,cancel).then(function (transfer,wallet,recipient) {
      var wallet=transfer._data.wallet;
      setTimeout(function() {
        should.exist(transfer.id)
        should.exist(transfer.bank.name)
        transfer.amount_reversed.should.equal(200);
        wallet.balance.should.equal(500)
        done()
      });
    })    
  });

  it("Debit user wallet to other wallet ", function(done){
    var transfer={
      amount:100,
      refid:'order 0123456',
      description:'commande truc ',
      type:'debit'
    }; 
    Wallets.transfer_create(userWallet.wid,transfer,otherWallet.wid).then(function (transfer,wallet,recipient) {
      var wallet=transfer._data.wallet;
      var recipient=transfer._data.recipient;
      setTimeout(function() {
        _.extend(validTransfer,transfer);
        should.exist(transfer.wallet)
        transfer.amount.should.equal(100);
        wallet.balance.should.equal(400)
        wallet.transfers.length.should.equal(2)

        recipient.balance.should.equal(600)
        recipient.transfers.length.should.equal(1)

        done()
      });
    })    

  });

  it("Cancel revious Debit  ", function(done){
    var transfer={
      amount:100,
      id:validTransfer.id
    }; 
    Wallets.transfer_cancel(userWallet.wid,transfer).then(function (transfer,wallet,recipient) {
      var wallet=transfer._data.wallet;
      var recipient=transfer._data.recipient;
      setTimeout(function() {
        _.extend(validTransfer,transfer);
        should.exist(transfer.wallet)
        transfer.amount_reversed.should.equal(100);
        wallet.balance.should.equal(500)
        wallet.transfers.length.should.equal(2)
        
        recipient.balance.should.equal(500)
        recipient.transfers.length.should.equal(1)

        done()
      });
    })    

  });

  
  it.skip("Transfer (DEBIT) current wallet to bank account", function(done){
  });


  it.skip("Select pending transfers", function(done){
  });

  it.skip("Select past transfers", function(done){
  });


  

});
