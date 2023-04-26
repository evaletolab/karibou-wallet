/**
 * Karibou payment wrapper
 * Customer
 */

 const config =require("../dist/config").default;
 const customer = require("../dist/customer");
 const payments = require("../dist/payments").Payment;
 const transaction = require("../dist/transaction");
 const xor = require("../dist/payments").xor;
 const $stripe = require("../dist/payments").$stripe;
 const should = require('should');


describe("Class transaction", function(){
  this.timeout(8000);

  let defaultCustomer;
  let defaultPaymentAlias;
  let defaultTX;

  const pm_valid = {
    type: 'card',
    card: {
      number: '4242424242424242',
      exp_month: 8,
      exp_year: 2025,
      cvc: '314',
    },
  };
 

  before(function(done){
    done();
  });

  after(async function () {
    await $stripe.customers.del(defaultCustomer.id);
  });

  // START TESTING
  it("Transaction create authorization", async function() {
    defaultCustomer = await customer.Customer.create("test@email.com","Foo","Bar","022345",1234);
    const pm = await $stripe.paymentMethods.create(pm_valid);

    const card = await defaultCustomer.addMethod(pm.id);
    defaultPaymentAlias = card.alias;

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

    //console.log('---- DBG report',tx._payment);
    //console.log('---- DBG report',tx.report);

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
      should.not.exist(tx);
    }catch(err) {
      should.exist(err);
    }
  });

  it("Transaction capture amount >1 fr should success", async function() {
    try{
      const tx = await transaction.Transaction.get(defaultTX);
      await tx.capture(1.0);
      tx.amount.should.equal(1);
      tx.authorized.should.equal(false);
      tx.captured.should.equal(true);
      tx.canceled.should.equal(false);
  
      //console.log('---- DBG report amount',tx._payment.amount);
      //console.log('---- DBG report amount_capturable',tx._payment.amount_capturable);
      //console.log('---- DBG report amount_received',tx._payment.amount_received);

    }catch(err) {
      should.not.exist(err);
    }
  });

  it("Transaction cancel a captured tx throw an error", async function() {
    try{
      const tx = await transaction.Transaction.get(defaultTX);
      await tx.cancel();
      should.not.exist(tx);
    }catch(err) {
      should.exist(err);
    }
  });

  it("Transaction total refund", async function() {
    try{
      const tx = await transaction.Transaction.get(defaultTX);
      tx.refunded.should.equal(0);
      await tx.refund();
      tx.refunded.should.equal(1);
    }catch(err) {
      should.exist(err);
    }

  });

  it("Transaction capture without minimal amount throw an error", async function() {

    try{
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
      should.not.exist(tx);
  
    }catch(err) {
      should.exist(err);
    }

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

    await tx.refund(1.0);
    tx.refunded.should.equal(3);


  });


});
