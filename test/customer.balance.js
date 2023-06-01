/**
 * Karibou payment wrapper
 * Customer
 */

const config =require("../dist/config").default;
const options = require('../config-test');
config.configure(options.payment);

const customer = require("../dist/customer");
const payments = require("../dist/payments").Payment;
const crypto_fingerprint = require("../dist/payments").crypto_fingerprint;
const xor = require("../dist/payments").xor;
const dateFromExpiry = require("../dist/payments").dateFromExpiry;
const $stripe = require("../dist/payments").$stripe;
const should = require('should');


describe("customer.balance", function(){
  this.timeout(8000);

  const custCleanList = [];

  const pm_valid = {
    type: 'card',
    card: {
      number: '4242424242424242',
      exp_month: 8,
      exp_year: 2025,
      cvc: '314',
    },
  };

  const pm_trigger_auth = {
    type: 'card',
    card: {
      number: '4000002500003155',
      exp_month: 8,
      exp_year: 2025,
      cvc: '314',
    },
  };

  const pm_fails = {
    type: 'card',
    card: {
      number: '4000000000009995',
      exp_month: 8,
      exp_year: 2025,
      cvc: '314',
    },
  };


  before(function(done){
    done()
  });

  after(async function () {    
    for (let cust of custCleanList) {
      await $stripe.customers.del(cust);
    }
  });

  // START TESTING
  it("stripe service should exist", async function() {
    should.exist($stripe);
    config.option('debug',false);
  });


  it("Construction of the customer", async function() {
    const cust = await customer.Customer.create("test@email.com","Foo","Bar","022345",1234);
    should.exist(cust);
    custCleanList.push(cust.id);
    cust.should.property('balance');
    cust.balance.should.equal(0);
  });


  it("Add negative credit throw an exception", async function() {
    const cust = await customer.Customer.get(custCleanList[0]);
    try{
      await cust.updateCredit(-1);      
      should.not.exist("dead zone");
    }catch(err) {
      err.message.should.containEql('must be a positive number');
    }
  });

  it("Authorize customer credit", async function() {
    const cust = await customer.Customer.get(custCleanList[0]);
    await cust.allowCredit(true);
    should.exist(cust);
    cust.allowedCredit().should.equal(true);
  });


  it("Add max credit throw an exception", async function() {
    const cust = await customer.Customer.get(custCleanList[0]);
    try{
      await cust.updateCredit(40.1);      
      should.not.exist("dead zone");
    }catch(err) {
      err.message.should.containEql('exceed limitation of');
    }
  });

  it("Add authorized credit is ok", async function() {
    const cust = await customer.Customer.get(custCleanList[0]);
    try{
      await cust.updateCredit(40);      
      cust.balance.should.equal(40);
    }catch(err) {
      console.log(err)
      should.not.exist(err);
    }
  });

  it("Add max credit throw an exception", async function() {
    const cust = await customer.Customer.get(custCleanList[0]);
    try{
      await cust.updateCredit(0.1);      
      should.not.exist("dead zone");
    }catch(err) {
      err.message.should.containEql('exceed limitation of');
    }
  });

  it("Add max negative credit throw an exception", async function() {
    const cust = await customer.Customer.get(custCleanList[0]);
    try{
      await cust.updateCredit(-80.1);      
      should.not.exist("dead zone");
    }catch(err) {
      err.message.should.containEql('Negative credit exceed limitation');
    }
  });

  it("Remove credit", async function() {
    const cust = await customer.Customer.get(custCleanList[0]);
    await cust.updateCredit(-40);      
    cust.balance.should.eql(0)
  });

  it("Unauthorize customer credit", async function() {
    const cust = await customer.Customer.get(custCleanList[0]);
    await cust.allowCredit(false);
    cust.allowedCredit().should.equal(false);
    cust.balance.should.eql(0)
  });

});
