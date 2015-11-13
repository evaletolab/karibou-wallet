/**
 * unit tests for the main wallet module
 * psp error: http://docs.openstream.ch/payment-provider/wallet-error-messages/
 */

var assert = require('assert');
var should = require('should');
var dbtools = require('./fixtures/dbtools');
var db = require('mongoose');

describe("driver.mongoose.race.transfer", function(){
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

  it("Credit our GIFTCODE with 4.00 CHF", function(done){
    var transfer={
      amount:400,
      type:'credit'
    }
    var races=[], wids={};
    races.push(Wallets.transfer_create(giftWallet.wid,transfer));
    races.push(Wallets.transfer_create(giftWallet.wid,transfer));
    races.push(Wallets.transfer_create(giftWallet.wid,transfer));

    Q.all(races).then(function(wallet) {
      should.not.exist(wallet)
    },function (error) {
      error.message.should.containEql('The wallet is already running another task')
      done();      
    })

  });

  it("Verify giftcode balance", function(done){
      Wallets.retrieve(giftWallet.wid).then(function (wallet) {
        wallet.card.number.should.equal(giftWallet.card.number)
        wallet.balance.should.equal(400);
        done();
      });
  });


  it("Try double register GIFTCODE  ", function(done){
    var card={
      name:'User registration',
      number:giftWallet.card.number
    };

    var races=[], wids={};
    races.push(Wallets.transferGiftcode(userWallet.wid,card));
    races.push(Wallets.transferGiftcode(userWallet.wid,card));

    Q.all(races).then(function(wallet) {
      console.log(wallet)
      should.not.exist(wallet)
    },function (error) {
      // this is important, race condition is trigged before the success transfer will' done
      setTimeout(function() {
        error.message.should.containEql('The wallet is already running another task')
        done();              
      }, 70);
    })

  });



  it("Verify wallet balance", function(done){
      Wallets.retrieve(userWallet.wid).then(function (wallet) {
        wallet.balance.should.equal(900);
        userWallet.balance.should.equal(500)
        done();
      });
  });

  

});
