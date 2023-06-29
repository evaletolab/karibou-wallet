/**
 * Karibou payment wrapper
 * Customer
 */

const config =require("../dist/config").default;
const options = require('../config-test');
config.configure(options.payment);

const customer = require("../dist/customer");
const unxor = require("../dist/payments").unxor;
const default_card_invoice = require("../dist/payments").default_card_invoice;
const card_mastercard_prepaid = require("../dist/payments").card_mastercard_prepaid;
const transaction = require("../dist/transaction");
const $stripe = require("../dist/payments").$stripe;
const should = require('should');
const axios = require('axios');
const { round1cts } = require("../dist/payments");


describe("transaction.balance.credit.consolidation", function(){
  this.timeout(8000);

  let initialBalance;
  let defaultCustomer;
  let defaultPaymentAlias;
  let defaultTX;
  let defaultAmountCaptured;
  let defaultAmountReserved;

  let allowMaxAmount = config.option('allowMaxAmount');
  let allowMaxCredit = config.option('allowMaxCredit');

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
    config.option('allowMaxAmount',allowMaxAmount*100);
    config.option('allowMaxCredit',allowMaxCredit*100);
    done();
  });

  after(async function () {
    await $stripe.customers.del(unxor(defaultCustomer.id));

    config.option('allowMaxAmount',allowMaxAmount);
    config.option('allowMaxCredit',allowMaxCredit);
  
  });

  it("Create customer with credit balance of -47.85 chf", async function(){
    config.option('debug',false);
    defaultCustomer = await customer.Customer.create("test@email.com","Foo","Bar","022345",1234);

    const card = await defaultCustomer.allowCredit(true);

    should.exist(card);
    should.exist(card.alias);
    defaultPaymentAlias = card.alias;

    initialBalance = -47.85
    defaultAmountReserved = 80;
    defaultAmountCaptured = 74.2;

    await defaultCustomer.updateCredit(initialBalance);
    
    const cust = await customer.Customer.get(defaultCustomer.id);
    cust.balance.should.equal(initialBalance);
    
  });


  it("Transaction create update credit", async function() {
    const tx = await transaction.Transaction.authorize(defaultCustomer,default_card_invoice,defaultAmountReserved,paymentOpts);
    should.exist(tx);
    defaultCustomer = await customer.Customer.get(tx.customer);
    tx.provider.should.equal("invoice");
    tx.amount.should.equal(defaultAmountReserved);
    tx.status.should.equal("authorized");


    tx.refunded.should.equal(0);
    // should.not.exist(tx._payment.shipping);

    defaultCustomer.balance.should.equal(initialBalance-defaultAmountReserved);


    // should.exist(tx.report.log);
    // should.exist(tx.report.transaction);
    defaultTX = tx;
  });  


  it("invoice Transaction capture partial create a bill and update balance", async function() {
    const orderPayment = {
      status:defaultTX.status,
      transaction:defaultTX.id,
      issuer:defaultTX.provider
    }
    const tx = await transaction.Transaction.fromOrder(orderPayment);
    defaultTX = await tx.capture(defaultAmountCaptured);
    tx.provider.should.equal("invoice");
    tx.amount.should.equal(defaultAmountCaptured);
    tx.status.should.equal("invoice");

    defaultCustomer = await customer.Customer.get(tx.customer);
    defaultCustomer.balance.should.equal(round1cts(initialBalance-defaultAmountCaptured));

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
    defaultTX.amount.should.equal(defaultAmountCaptured-1);
    defaultTX.refunded.should.equal(round1cts(1 + defaultAmountReserved-defaultAmountCaptured));

    defaultCustomer = await customer.Customer.get(tx.customer);
    defaultCustomer.balance.should.equal(round1cts(initialBalance-defaultAmountCaptured+1));


  });  


  xit("invoice Transaction refund all available amount 3 of 3", async function() {
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

});
