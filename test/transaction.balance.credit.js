/**
 * Karibou payment wrapper
 * Customer
 */

const config =require("../dist/config").default;
const options = require('../config-test');
config.configure(options.payment);

const customer = require("../dist/customer");
const unxor = require("../dist/payments").unxor;
const card_mastercard_prepaid = require("../dist/payments").card_mastercard_prepaid;
const default_card_invoice = require("../dist/payments").default_card_invoice;
const transaction = require("../dist/transaction");
const $stripe = require("../dist/payments").$stripe;
const should = require('should');
const axios = require('axios');
const { default: Config } = require("../dist/config");


describe("Class transaction with negative customer credit", function(){
  this.timeout(8000);

  let defaultCustomer;
  let defaultPaymentAlias;
  let defaultTX;

  const paymentOpts = {
    oid: '01234',
    txgroup: 'AAA',
    shipping: {
        streetAdress: 'rue du rhone 69',
        postalCode: '1208',
        name: 'Credit balance testing family'
    }
  };


  before(function(done){
    done();
  });

  after(async function () {
    await $stripe.customers.del(defaultCustomer.id);
  });

  it("Create customer with credit balance", async function(){
    config.option('debug',false);
    defaultCustomer = await customer.Customer.create("test@email.com","Foo","Bar","022345",1234);


    // 
    // testing negative credit
    const card = await defaultCustomer.allowCredit(true);

    should.exist(card);
    should.exist(card.alias);
    defaultPaymentAlias = card.alias;
  });



  it("Transaction create with exceeded credit limit throw an error", async function() {
    try{
      const tx = await transaction.Transaction.authorize(defaultCustomer,default_card_invoice,40.1,paymentOpts)
      should.not.exist("dead zone");
    }catch(err) {
      err.message.should.containEql('Negative credit exceed limitation')
    }
  });  

  it("Transaction create with suffisant fund is ok", async function() {
    const tx = await transaction.Transaction.authorize(defaultCustomer,default_card_invoice,10.05,paymentOpts);
    should.exist(tx);
    defaultCustomer = await customer.Customer.get(tx.customer);
    defaultCustomer.balance.should.equal(-10.05)
    tx.provider.should.equal("invoice");
    tx.amount.should.equal(10.05);
    tx.status.should.equal("authorized");
    tx.authorized.should.equal(true);
    tx.group.should.equal('#01234');
    tx.oid.should.equal('01234');
    tx.requiresAction.should.equal(false);
    tx.captured.should.equal(false);
    tx.canceled.should.equal(false);
    tx.refunded.should.equal(0);
    should.not.exist(tx._payment.shipping);

    should.exist(tx.report.log);
    should.exist(tx.report.transaction);
    defaultTX = tx;
  });  


  it("invoice Transaction load from Order", async function() {
    const orderPayment = {
      status:defaultTX.status,
      transaction:defaultTX.id,
      issuer:defaultTX.provider
    }
    const tx = await transaction.Transaction.fromOrder(orderPayment);
    tx.provider.should.equal("invoice");
    tx.amount.should.equal(10.05);
    tx.status.should.equal("authorized");
    tx.authorized.should.equal(true);
    tx.group.should.equal('#01234');
    tx.oid.should.equal('01234');
    tx.requiresAction.should.equal(false);
    tx.captured.should.equal(false);
    tx.canceled.should.equal(false);
    tx.refunded.should.equal(0);
    should.not.exist(tx._payment.shipping);

  });

  it("invoice Transaction capture amount >10 fr throws an error", async function() {
    try{
      // KngOrderPayment
      const orderPayment = {
        status:defaultTX.status,
        transaction:defaultTX.id,
        issuer:defaultTX.provider
      }
      const tx = await transaction.Transaction.fromOrder(orderPayment);
      await tx.capture(10.06);
      should.not.exist("dead zone");
    }catch(err) {
      //  requested capture amount is greater than the amount you can capture for this charge
      err.message.should.containEql('capture amount is greater than the');
    }
  });  

  it("invoice Transaction capture negative amount throws an error", async function() {
    try{
      // KngOrderPayment
      const orderPayment = {
        status:defaultTX.status,
        transaction:defaultTX.id,
        issuer:defaultTX.provider
      }
      const tx = await transaction.Transaction.fromOrder(orderPayment);
      await tx.capture(-1);
      should.not.exist("dead zone");
    }catch(err) {
      err.message.should.containEql('a null or positive amount to proceed');
    }
  });  


  it("invoice Transaction refund before capture or cancel throws an error", async function() {
    try{
      // KngOrderPayment
      const orderPayment = {
        status:defaultTX.status,
        transaction:defaultTX.id,
        issuer:defaultTX.provider
      }
      const tx = await transaction.Transaction.fromOrder(orderPayment);
      tx.provider.should.equal("invoice");
      await tx.refund();
      should.not.exist("dead zone");
    }catch(err) {
      err.message.should.containEql('refunded before capture');
    }
  });  


  it("invoice Transaction capture partial amount 4 of 10", async function() {
    const orderPayment = {
      status:defaultTX.status,
      transaction:defaultTX.id,
      issuer:defaultTX.provider
    }
    const tx = await transaction.Transaction.fromOrder(orderPayment);
    defaultTX = await tx.capture(4.01);
    defaultTX.provider.should.equal("invoice");
    defaultTX.status.should.equal("invoice");
    defaultTX.amount.should.equal(4.01);
    defaultTX.refunded.should.equal(6.04);
  });

  it("invoice Transaction refund amount too large throw an error", async function() {
    try{
      const orderPayment = {
        status:defaultTX.status,
        transaction:defaultTX.id,
        issuer:defaultTX.provider
      }
      const tx = await transaction.Transaction.fromOrder(orderPayment);
      await tx.refund(7.0);
      should.not.exist("dead zone");

    }catch(err){
      err.message.should.containEql('The refund has exceeded the amount available');
    }
  });

  it("invoice Transaction refund partial amount 1 of 4.01", async function() {
    const orderPayment = {
      status:defaultTX.status,
      transaction:defaultTX.id,
      issuer:defaultTX.provider
    }
    const tx = await transaction.Transaction.fromOrder(orderPayment);
    defaultTX = await tx.refund(1.0);
    defaultTX.provider.should.equal("invoice");
    defaultTX.status.should.equal("refunded");
    defaultTX.amount.should.equal(3.01);
    defaultTX.refunded.should.equal(7.04);
  });  


  it("invoice Transaction refund amount too large between refunds throw an error", async function() {
    try{
      const orderPayment = {
        status:defaultTX.status,
        transaction:defaultTX.id,
        issuer:defaultTX.provider
      }
      const tx = await transaction.Transaction.fromOrder(orderPayment);
      await tx.refund(3.1);
      should.not.exist("dead zone");

    }catch(err){
      //  requested capture amount is greater than the amount you can capture for this charge
      err.message.should.containEql('The refund has exceeded the amount available');
    }
  });  

  it("invoice Transaction refund all available amount 3 of 3", async function() {
    const orderPayment = {
      status:defaultTX.status,
      transaction:defaultTX.id,
      issuer:defaultTX.provider
    }
    const tx = await transaction.Transaction.fromOrder(orderPayment);
    defaultTX = await tx.refund();
    defaultTX.provider.should.equal("invoice");
    defaultTX.status.should.equal("refunded");
    defaultTX.amount.should.equal(0);
    defaultTX.refunded.should.equal(10.05);
  });  

  it("invoice Transaction refund amount when amount eql 0 throw an error", async function() {
    try{
      const orderPayment = {
        status:defaultTX.status,
        transaction:defaultTX.id,
        issuer:defaultTX.provider
      }
      const tx = await transaction.Transaction.fromOrder(orderPayment);
      await tx.refund(0.1);
      should.not.exist("dead zone");

    }catch(err){
      err.message.should.containEql('The refund has exceeded the amount available');
    }
  });  

  it("invoice Transaction cancel after refund throw an error", async function() {
    try{
      const orderPayment = {
        status:defaultTX.status,
        transaction:defaultTX.id,
        issuer:defaultTX.provider
      }
      const tx = await transaction.Transaction.fromOrder(orderPayment);
      await tx.cancel();
      should.not.exist("dead zone");

    }catch(err){
      err.message.should.containEql('Impossible to cancel captured transaction');
    }
  });  
  
    

});
