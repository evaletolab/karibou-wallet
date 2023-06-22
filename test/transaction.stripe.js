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
 const card_authenticationRequired = require("../dist/payments").card_authenticationRequired;
 const card_visa_chargeDeclined = require("../dist/payments").card_visa_chargeDeclined;
 const card_visa_chargeDeclinedLostCard = require("../dist/payments").card_visa_chargeDeclinedLostCard;

 const transaction = require("../dist/transaction");
 const $stripe = require("../dist/payments").$stripe;
 const should = require('should');


describe("Class transaction.stripe", function(){
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
        name: 'foo bar family'
    }
  };


  before(function(done){
    done();
  });

  after(async function () {
    await $stripe.customers.del(unxor(defaultCustomer.id));
  });
  it("Create list of cards for testing transaction", async function(){
    config.option('debug',false);
    defaultCustomer = await customer.Customer.create("test@email.com","Foo","Bar","022345",1234);

    //
    // valid US - 067c7f79097066667c6477516477767d 
    const card = await defaultCustomer.addMethod(unxor(card_mastercard_prepaid.id));
    defaultPaymentAlias = card.alias;

  });



  //
  // https://stripe.com/docs/automated-testing
  it("Transaction authorization throw authenticationRequired", async function() {
    const tx = await transaction.Transaction.authorize(defaultCustomer,card_authenticationRequired,2,paymentOpts)
    tx.should.property("status");
    tx.status.should.equal("requires_action");
    tx.should.property("client_secret");
    tx.client_secret.should.containEql("pi_");
  });

  it("Transaction authorization throw chargeDeclined", async function() {
    try{
      const tx = await transaction.Transaction.authorize(defaultCustomer,card_visa_chargeDeclined,2,paymentOpts)
      should.not.exist("dead zone");
    }catch(err){
      should.exist(err);
      err.message.should.containEql("La banque a refusé")
    }
  });

  it("Transaction authorization throw chargeDeclinedLostCard", async function() {
    try{
      const tx = await transaction.Transaction.authorize(defaultCustomer,card_visa_chargeDeclinedLostCard,2,paymentOpts)
      should.not.exist("dead zone");
    }catch(err){
      //console.log('...',err.message)
      err.message.should.containEql("la carte est déclarée perdue")
    }
  });

  it("Transaction authorization throw 0 amount exception", async function() {
    try{
      const card = defaultCustomer.findMethodByAlias(defaultPaymentAlias);
      const tx = await transaction.Transaction.authorize(defaultCustomer,card,0,paymentOpts)
      should.not.exist("dead zone");
    }catch(err){
      err.message.should.containEql("Minimum amount")
    }
  });

  it("Transaction create authorization", async function() {

    // load card from default customer
    const card = defaultCustomer.findMethodByAlias(defaultPaymentAlias);
    const tx = await transaction.Transaction.authorize(defaultCustomer,card,2,paymentOpts)
    tx.should.property("amount");
    tx.should.property("group");
    tx.should.property("customer");
    tx.authorized.should.equal(true);
    tx.amount.should.equal(2);
    tx.group.should.equal('AAA');
    tx.oid.should.equal('01234');
    tx.requiresAction.should.equal(false);
    tx.captured.should.equal(false);
    tx.canceled.should.equal(false);
    tx.refunded.should.equal(0);
    should.exist(tx._payment.shipping);

    should.exist(tx.report.log);
    should.exist(tx.report.transaction);

    defaultTX = tx.id;
  });

  it("Transaction load authorization", async function() {
    const tx = await transaction.Transaction.get(defaultTX);
    tx.authorized.should.equal(true);
    tx.amount.should.equal(2);
    tx.oid.should.equal('01234');
    tx.requiresAction.should.equal(false);
    tx.captured.should.equal(false);
    tx.canceled.should.equal(false);
    tx.refunded.should.equal(0);
    should.exist(tx.report.log);
    should.exist(tx.report.transaction);
    // console.log('---- DBG report amount_capturable',tx._payment.amount_capturable);
    // console.log('---- DBG report amount_received',tx._payment.amount_received);

  });

  it("Transaction capture amount >2 fr throws an error", async function() {
    try{
      const tx = await transaction.Transaction.get(defaultTX);
      await tx.capture(2.01);
      should.not.exist("dead zone");
    }catch(err) {
      err.message.should.containEql('requested capture amount is greater than the amount you can capture for this charge');
    }
  });

  it("Transaction capture amount >1 fr should success", async function() {
    const tx = await transaction.Transaction.get(defaultTX);
    await tx.capture(1.0);
    tx.amount.should.equal(1);
    tx.authorized.should.equal(false);
    tx.captured.should.equal(true);
    tx.canceled.should.equal(false);

    //console.log('---- DBG report amount',tx._payment.amount);
    //console.log('---- DBG report amount_capturable',tx._payment.amount_capturable);
    //console.log('---- DBG report amount_received',tx._payment.amount_received);

  });

  it("Transaction cancel a captured tx throw an error", async function() {
    try{
      const tx = await transaction.Transaction.get(defaultTX);
      await tx.cancel();
      should.not.exist("dead zone");
    }catch(err) {
      err.message.should.containEql('Impossible to cancel captured transaction');
    }
  });

  it("Transaction total refund", async function() {
    const tx = await transaction.Transaction.get(defaultTX);
    tx.refunded.should.equal(0);
    tx.amount.should.equal(1);
    await tx.refund();
    tx.refunded.should.equal(1);
  });
    
  it("Transaction capture amount = 0", async function() {

    // load card from default customer
    const card = defaultCustomer.findMethodByAlias(defaultPaymentAlias);

    let tx = await transaction.Transaction.authorize(defaultCustomer,card,2,paymentOpts)
    await tx.capture(0);
    tx.status.should.equal('canceled');
    tx.amount.should.equal(0);
  });

  it("Transaction capture belown minimal amount is impossible", async function() {

    const paymentOpts = {
      oid: '01234',
      txgroup: 'AAA',
      email: 'foo@bar',
      shipping: {
          streetAdress: 'rue du rhone 69',
          postalCode: '1208',
          name: 'foo bar family'
      }
    };

    const card = defaultCustomer.findMethodByAlias(defaultPaymentAlias);
    const tx = await transaction.Transaction.authorize(defaultCustomer,card,4.55,paymentOpts)
    await tx.capture(0.01);    
    tx.amount.should.equal(1);

  });

  it("Transaction partial refund", async function() {
    const paymentOpts = {
      oid: '01234',
      txgroup: 'AAA',
      email: 'foo@bar',
      shipping: {
          streetAdress: 'rue du rhone 69',
          postalCode: '1208',
          name: 'foo bar family'
      }
    };

    // load card from default customer
    const card = defaultCustomer.findMethodByAlias(defaultPaymentAlias);

    // create TX
    const tx = await transaction.Transaction.authorize(defaultCustomer,card,4.55,paymentOpts)

    // capture TX
    await tx.capture(4.55);

    // partial refund TX
    await tx.refund(2.0);
    tx.refunded.should.equal(2);

    const atx = await transaction.Transaction.get(tx.id);

    await atx.refund(1.0);
    atx.refunded.should.equal(3);
    atx.amount.should.equal(4.55);

    defaultTX = tx;

  });


  it("Transaction from Order refund all", async function() {
    const orderPayment = {
      status:defaultTX.status,
      transaction:defaultTX.id,
      issuer:'mastercard'
    }
    const tx = await transaction.Transaction.fromOrder(orderPayment);
    tx.provider.should.equal("stripe");
    tx.refunded.should.equal(3);
    tx.status.should.equal("refunded");

    await tx.refund();
    tx.refunded.should.equal(4.55);
    tx.amount.should.equal(4.55);


  });

  it("Transaction create and cancel", async function() {

    // load card from default customer
    const card = defaultCustomer.findMethodByAlias(defaultPaymentAlias);
    const tx = await transaction.Transaction.authorize(defaultCustomer,card,2,paymentOpts)
    await tx.cancel();
  });

});
