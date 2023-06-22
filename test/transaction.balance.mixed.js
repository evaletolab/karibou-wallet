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


describe("Class transaction with credit.balance mixed with other payment", function(){
  this.timeout(8000);

  let defaultCustomer;
  let defaultPaymentAlias;
  let defaultTXtoRefund;
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
    await $stripe.customers.del(unxor(defaultCustomer.id));
  });

  it("Create customer with negative credit balance", async function(){
    config.option('debug',false);
    defaultCustomer = await customer.Customer.create("test@email.com","Foo","Bar","022345",1234);


    // 
    // testing negative credit with a limit
    await defaultCustomer.allowCredit(true);

    //
    // valid US - 067c7f79097066667c6477516477767d 
    const card = await defaultCustomer.addMethod(unxor(card_mastercard_prepaid.id));
    defaultPaymentAlias = card.alias;
  });





  it("Transaction create with exceeded credit limit throw an error", async function() {
    try{
      const tx = await transaction.Transaction.authorize(defaultCustomer,default_card_invoice,40.1,paymentOpts)
      should.not.exist("dead zone");
    }catch(err) {
      err.message.should.containEql('Vous avez atteind la limite de crédit de votre compte')
    }
  });  
  


  it("Transaction create visa payment over the credit account", async function() {
    const card = defaultCustomer.findMethodByAlias(defaultPaymentAlias);
    const tx = await transaction.Transaction.authorize(defaultCustomer,card,20,paymentOpts)
    defaultCustomer = await customer.Customer.get(tx.customer);
    defaultCustomer.balance.should.equal(0);
    tx.status.should.equal("requires_capture");
    tx.provider.should.equal("stripe");
    tx.customerCredit.should.equal(0);
    defaultTX = tx;
  });


  it("Transaction create mixed payment credit plus prepaid visa", async function() {
    const card = defaultCustomer.findMethodByAlias(defaultPaymentAlias);
    await defaultCustomer.updateCredit(10);
    const tx = await transaction.Transaction.authorize(defaultCustomer,card,20,paymentOpts)
    defaultCustomer = await customer.Customer.get(tx.customer);
    defaultCustomer.balance.should.equal(0);
    tx.status.should.equal("requires_capture");
    tx.provider.should.equal("stripe");
    tx.customerCredit.should.equal(10);
    defaultTX = tx;
  });



  it("Transaction capture amount 15 fr", async function() {
    const tx = await transaction.Transaction.get(defaultTX.id);
    const cmp = await tx.capture(15);
    tx.amount.should.equal(15);
    tx.status.should.equal("paid");

  });  

  it("Transaction refound amount 10 fr", async function() {
    const tx = await transaction.Transaction.get(defaultTX.id);
    const cmp = await tx.refund(10);
    tx.amount.should.eql(15);
    tx.refunded.should.eql(10);
    tx.status.should.eql("refunded");

    defaultCustomer = await customer.Customer.get(tx.customer);
    defaultCustomer.balance.should.equal(5);
  });  


  it("Transaction refound all", async function() {
    const tx = await transaction.Transaction.get(defaultTX.id);
    const cmp = await tx.refund();
    console.log('---- tx ', tx.amount);
    console.log('---- tx ', tx.refunded);
    console.log('---- tx ', tx.status);
    tx.amount.should.eql(15);
    tx.refunded.should.eql(15);
    tx.status.should.eql("refunded");

    defaultCustomer = await customer.Customer.get(tx.customer);
    defaultCustomer.balance.should.equal(10);
  });    


  
});
