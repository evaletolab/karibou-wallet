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


describe("Class transaction with credit.balance", function(){
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
    // testing negative credit
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
  


  xit("Transaction create mixed payment credit plus prepaid visa", async function() {
    const card = defaultCustomer.findMethodByAlias(defaultPaymentAlias);
    await defaultCustomer.updateCredit(10);    
    const tx = await transaction.Transaction.authorize(defaultCustomer,card,20,paymentOpts)
    defaultCustomer = await customer.Customer.get(tx.customer);
    defaultCustomer.balance.should.equal(0);
    //tx.status.should.equal("authorized");
    tx.provider.should.equal("stripe");
    tx.customerCredit.should.equal(10);
    defaultTX = tx;
  });

  //
  // https://stripe.com/docs/payments/bank-transfers/accept-a-payment?platform=api&invoices=without#web-create-and-confirm-payment-intent
  xit("Transaction with creditcreate with insufisant fund throw an error", async function() {
    try{
      const card = defaultCustomer.findMethodByAlias(defaultPaymentAlias);
      const tx = await transaction.Transaction.authorize(defaultCustomer,default_card_invoice,101,paymentOpts)
      should.not.exist("dead zone");
    }catch(err) {
      err.message.should.containEql('balance is insufficient to complete the payment')
      should.exist(err);
    }
  });  



  // START TESTING
  xit("Transaction create valid cashbalance authorization", async function() {

    // load card from default customer
    const card = defaultCustomer.findMethodByAlias(defaultPaymentAlias);

    const tx = await transaction.Transaction.authorize(defaultCustomer,card,2,paymentOpts)
    tx.should.property("amount");
    tx.authorized.should.equal(true);
    tx.amount.should.equal(2);
    tx.status.should.equal('prepaid');
    tx.requiresAction.should.equal(false);
    tx.captured.should.equal(true);
    tx.canceled.should.equal(false);
    tx.refunded.should.equal(0);
    should.exist(tx._payment.shipping);

    should.exist(tx.report.log);
    should.exist(tx.report.transaction);

    //console.log('---- DBG report',tx.report);

    defaultTX = tx.id;
  });

  xit("Transaction capture amount >2 fr throws an error", async function() {
    try{
      const tx = await transaction.Transaction.get(defaultTX);
      await tx.capture(2.01);
      should.not.exist("dead zone");
    }catch(err) {
      should.exist(err);
    }
  });  

  xit("Transaction capture amount >1 fr should success", async function() {
    const tx = await transaction.Transaction.get(defaultTX);
    await tx.capture(1.0);
    tx.amount.should.equal(2);
    tx.authorized.should.equal(false);
    tx.captured.should.equal(true);
    tx.canceled.should.equal(false);
    tx.status.should.equal('refund');
  });

  xit("Transaction cancel a captured tx throw an error", async function() {
    try{
      const tx = await transaction.Transaction.get(defaultTX);
      await tx.cancel();
      should.not.exist("dead zone");
    }catch(err) {
      err.message.should.containEql('Impossible to cancel captured transaction');
    }
  });  


  xit("Cash balance is correctly consolidated ", async function() {
    defaultCustomer = await customer.Customer.get(defaultCustomer.id);
    defaultCustomer.cashbalance.available.eur.should.equal(98);
  });


  xit("List cash balance bank transfer ", async function() {
    const cust = await customer.Customer.get(defaultCustomer.id);
    const tx = await cust.listBankTransfer();
    // console.log('--- DBG tx',tx)
    should.exist(tx);
    should.exist(tx.length);    
  });


  xit("Create new Transaction to empty the cashbalance account  ", async function() {

    // load card from default customer
    const card = defaultCustomer.findMethodByAlias(defaultPaymentAlias);
    const tx = await transaction.Transaction.authorize(defaultCustomer,card,98,paymentOpts)
    should.exist(tx);

    defaultCustomer = await customer.Customer.get(defaultCustomer.id);
    console.log('--- DBG cash',defaultCustomer.cashbalance);
    defaultCustomer.cashbalance.available.eur.should.equal(0);


  });  
    

});
