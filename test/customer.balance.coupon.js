/**
 * Karibou payment wrapper
 * Customer
 */

const config =require("../dist/config").default;
const options = require('../config-test');
config.configure(options.payment);

const customer = require("../dist/customer");
const payments = require("../dist/payments").Payment;
const unxor = require("../dist/payments").unxor;
const $stripe = require("../dist/payments").$stripe;
const should = require('should');


describe("customer.balance.coupon", function(){
  this.timeout(8000);

  const custCleanList = [];

  let couponcode;

  before(function(done){
    done()
  });

  after(async function () {    
    for (let cust of custCleanList) {
      await $stripe.customers.del(unxor(cust));
    }
  });

  // START TESTING
  it("stripe service should exist", async function() {
    should.exist($stripe);
    config.option('debug',false);
  });


  it("Construction of the customer and coupon", async function() {
    const cust = await customer.Customer.create("test@email.com","Foo","Bar","022345",1234);
    should.exist(cust);
    custCleanList.push(cust.id);
    cust.should.property('balance');
    cust.balance.should.equal(0);

    const coupon = await $stripe.coupons.create({
      amount_off: 1000,
      currency:'CHF'
    });    
    should.exist(cust);
    couponcode = coupon.id;


  });


  it("add coupon credit ", async function() {
    const cust = await customer.Customer.get(custCleanList[0]);
    await cust.applyCoupon(couponcode);
  });

  it("balance should equal coupon", async function() {
    const cust = await customer.Customer.get(custCleanList[0]);
    cust.balance.should.equal(10)    

  });
  it(" coupon is no more available", async function() {
    try{
      await $stripe.coupons.del(couponcode);
      should.not.exist("dead zone");
    }catch(err){
      err.message.should.containEql('No such coupon');
    }
  });

  it("add coupon credit throw an exception in race condition", async function() {
    const cust = await customer.Customer.get(custCleanList[0]);
    try{
      cust.applyCoupon(couponcode).then(()=>{}).catch(()=>{});      
      await cust.applyCoupon(couponcode);
      should.not.exist("dead zone");
    }catch(err) {
      err.message.should.containEql('reentrancy detection');
    }
  });


});
