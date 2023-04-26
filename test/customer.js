/**
 * Karibou payment wrapper
 * Customer
 */

const config =require("../dist/config").default;
const customer = require("../dist/customer");
const payments = require("../dist/payments").Payment;
const xor = require("../dist/payments").xor;
const $stripe = require("../dist/payments").$stripe;
const should = require('should');


describe("Class customer", function(){
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

  it("Construction of the customer failed missing uid", async function() {
    try{
      const cust = await customer.Customer.create("test@email.com","Bar","Foo");
      should.not.exist(true);  
    }catch(err){}
  });

  it("Construction of the customer failed missing phone", async function() {
    try{
      const cust = await customer.Customer.create("test@email.com","Bar","Foo","022345");
      should.not.exist(true);  
    }catch(err){}
  });

  it("Construction of the customer failed missing name", async function() {
    try{
      const cust = await customer.Customer.create("test@email.com","Bar","Pouet","022345",1234);
      should.not.exist(true);  
    }catch(err){}
  });

  it("Construction of the customer failed missing email", async function() {
    try{
      const cust = await customer.Customer.create("","Bar","Pouet","022345",1234);
      should.not.exist(true);  
    }catch(err){}
  });


  it("Construction of the customer", async function() {
    const cust = await customer.Customer.create("test@email.com","Foo","Bar","022345",1234);
    should.exist(cust);
    custCleanList.push(cust.id);
    cust.should.property('addMethod');
    cust.email.should.equal("test@email.com");
    cust.uid.should.equal('1234');
    cust.phone.should.equal('022345');
    cust.name.familyName.should.equal("Foo");
    cust.name.givenName.should.equal("Bar");
  });

  it("Get customer with id", async function() {
    const cust = await customer.Customer.get(custCleanList[0]);
    should.exist(cust);
    cust.should.property('addMethod');
    cust.email.should.equal("test@email.com");
    cust.uid.should.equal('1234');
    cust.phone.should.equal('022345');
    cust.name.familyName.should.equal("Foo");
    cust.name.givenName.should.equal("Bar");

  });

  it("Add new address", async function() {
    const add = {
      name:'Olivier E',
      note:'code 123',
      floor:'rez',
      streetAddress:'3 route de chene',
      region:'ge',
      postalCode:'1208',
      lat:'12',
      lng:'34'    
    };
    const cust = await customer.Customer.get(custCleanList[0]);
    should.exist(cust);
    cust.should.property('addressAdd');
    cust.addresses.length.should.equal(0);
    await cust.addressAdd(add);
    cust.addresses.length.should.equal(1);
    cust.addresses[0].id.should.equal('addr-01');
    cust.addresses[0].name.should.equal('Olivier E');
    cust.addresses[0].note.should.equal('code 123');
    cust.addresses[0].floor.should.equal('rez');
    cust.addresses[0].lat.should.equal('12');
    cust.addresses[0].lng.should.equal('34');
    cust.addresses[0].postalCode.should.equal('1208');
    cust.addresses[0].region.should.equal('ge');
  });

  it("update address", async function() {
    const cust = await customer.Customer.get(custCleanList[0]);
    should.exist(cust);
    cust.should.property('addressUpdate');
    await cust.addressUpdate(cust.addresses[0]);
    cust.addresses[0].id.should.equal('addr-01');
    cust.addresses[0].name.should.equal('Olivier E');
    cust.addresses[0].note.should.equal('code 123');
    cust.addresses[0].floor.should.equal('rez');
    cust.addresses[0].lat.should.equal('12');
    cust.addresses[0].lng.should.equal('34');
    cust.addresses[0].postalCode.should.equal('1208');
    cust.addresses[0].region.should.equal('ge');

  });


  it("delete address", async function() {
    const cust = await customer.Customer.get(custCleanList[0]);
    should.exist(cust);
    cust.should.property('addressRemove');
    await cust.addressRemove(cust.addresses[0]);
    //console.log('-----',cust.addresses);

  });
  
  it("Add payments methods using valid informations", async function() {
    config.option('debug',true);
    const cust = await customer.Customer.get(custCleanList[0]);
    const pm = await $stripe.paymentMethods.create(pm_valid);

    const payment = await cust.addMethod(pm.id);


    payment.alias.should.equal(xor(pm.card.fingerprint))
    payment.id.should.equal(xor(pm.id))
    payment.country.should.equal('US')
    payment.last4.should.equal('4242')
    payment.issuer.should.equal('visa')
    payment.funding.should.equal('credit')
    should.exist(payment.fingerprint)
    payment.expiry.should.equal('8/2025')

  });

  it("Update payments methods using same valid card", async function() {

    config.option('debug',true);
    const cust = await customer.Customer.get(custCleanList[0]);
    const pm_update = Object.assign({},pm_valid);
    pm_update.card.exp_year = 2026;
    const pm = await $stripe.paymentMethods.create(pm_update);
    const payment = await cust.addMethod(pm.id);
    payment.expiry.should.equal('8/2026')

  });

  it("List all payment's method return latest method", async function() {
    const cust = await customer.Customer.get(custCleanList[0]);    
    cust.methods.length.should.equal(1);
    cust.methods[0].expiry.should.equal('8/2026')
  });

  xit("Remove a payment's method", function(done) {
    customer.Customer.create("test@email.com","Bar","Foo").then(function (cust) {
      custCleanList.push(cust.id);
      var promises = [];
      var promises2 = [];
      promises.push(cust.addMethod(sourceData,"tok_visa").catch(done));
      promises.push(cust.addMethod(sourceData,"tok_mastercard").catch(done));
      promises.push(cust.addMethod(sourceData,"tok_mastercard").catch(done));

      Promise.all(promises)
        .then(() => cust.getMethodList())
        .then((p1) => cust.removeMethod(p1[0].id))
        .then(() => cust.getMethodList())
        .then((p2) => {p2.length.should.equal(2); done();});
    }).catch(done);
  });


});
