/**
 * unit tests for the main wallet module
 * psp error: http://docs.openstream.ch/payment-provider/wallet-error-messages/
 */

var assert = require('assert');
var should = require('should');
var dbtools = require('./fixtures/dbtools');
var db = require('mongoose');

describe.skip("driver.mongoose.transfer", function(){
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
        //console.log('-----------------user',wallet.email,wallet.balance);
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
        //console.log('-----------------gift',wallet.email,wallet.balance);
        done();
      }, 0);
    });
  });

  it("Check if recipients are differents (wallet to wallet)", function(done){
    var transfer={
      amount:400,
      type:'debit',
    }
    Wallets.transfer_create(giftWallet.wid,transfer,giftWallet.wid).then(undefined, function (error) {
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
    Wallets.transfer_create(giftWallet.wid,transfer,otherWallet.wid).then(undefined, function (error) {
      setTimeout(function() {
        error.message.should.equal('Le montant sur la carte est insuffisant !')
        done()
      });
    });

  });


  it("Debit our empty wallet throw an error", function(done){
    var transfer={
      amount:4700,
      type:'debit',
    }
    Wallets.transfer_create(otherWallet.wid,transfer,giftWallet.wid).then(undefined, function (error) {
      setTimeout(function() {
        error.message.should.equal('Le montant sur le compte est insuffisant !')
        done()
      });
    });

  });

  it("Credit our GIFTCODE with wrong recipient ", function(done){
    var transfer={
      amount:-100,
      description:'Hohoho',
      type:'credit'
    }
    Wallets.transfer_create(userWallet.wid,transfer,'ddd').then(undefined, function (error) {
      setTimeout(function() {
        error.message.should.containEql('La provenance bancaire de votre transfert ')
        done();
      });
    })
  });


  it("Credit our GIFTCODE with wrong source recipient ", function(done){
    var transfer={
      amount:-100,
      description:'Hohoho',
      type:'credit'
    }
    Wallets.transfer_create(userWallet.wid,transfer,'wa_1234567891').then(undefined, function (error) {
      setTimeout(function() {
        error.message.should.containEql('La provenance bancaire de votre transfert ')
        done();
      });
    })
  });

  it("Credit our GIFTCODE with negative amount ", function(done){
    var transfer={
      amount:-100,
      description:'Hohoho',
      type:'credit'
    }, bank={
      name:'stripe',
      account:'123-12345-6'
    }
    Wallets.transfer_create(userWallet.wid,transfer,bank).then(undefined, function (error) {
      setTimeout(function() {
        error.message.should.containEql('Le montant n\'est pas valide')
        done();
      });
    })
  });

  it("Credit our GIFTCODE with 4.00 CHF", function(done){
    var transfer={
      amount:400,
      type:'credit'
    }, bank={
      name:'stripe',
      account:'123-12345-6'
    }
    Wallets.transfer_create(giftWallet.wid,transfer,bank).then(function (transfer,wallet) {
      setTimeout(function() {
        // console.log('-----------------gift',wallet.email,wallet.balance,transfer.id);
        wallet.balance.should.equal(400)
        wallet.transfers.length.should.equal(1)
        done()
      });
    })
  });

  it("Debit our GIFTCODE with 2.00 CHF", function(done){
    var transfer={
      amount:200,
      type:'debit'
    }, bank={
      name:'stripe',
      account:'123-12345-6'
    }
    Wallets.transfer_create(giftWallet.wid,transfer,bank).then(function (transfer,wallet) {
      setTimeout(function() {
        //console.log('-----------------gift',wallet.email,wallet.balance);
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



    Wallets.transferGiftcode(userWallet.wid,card).then(function (wallet) {
      setTimeout(function() {
        //console.log('-----------------user',wallet.email,wallet.balance);
        should.exist(wallet.card);
        should.exist(wallet.card.last4);
        wallet.balance.should.equal(700)
        wallet.wid.should.equal(userWallet.wid);
        wallet.card.last4.should.equal(userWallet.card.number.substr(16-4));
        done();
      });
    });
  });


  it("Credit our wallet with already credited giftcode ", function(done){
    var card={
      name:'Paf Le chien',
      number:giftWallet.card.number,
    };

    Wallets.transferGiftcode(userWallet.wid,card).then(undefined, function (error) {
      setTimeout(function() {
        error.message.should.equal('Le montant sur la carte est insuffisant !')
        // error.message.should.equal('The card can not be transfered')
        done();
      });
    });
  });



  it.skip("Transfer (DEBIT) current wallet to bank account", function(done){
  });


  it.skip("Select pending transfers", function(done){
  });

  it.skip("Select past transfers", function(done){
  });




});
