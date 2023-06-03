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


describe("customer", function(){
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
    cust.balance.should.equal(0);
    cust.phone.should.equal('022345');
    cust.name.familyName.should.equal("Foo");
    cust.name.givenName.should.equal("Bar");
    should.exist(cust.cashbalance);
    should.not.exist(cust.cashbalance.available);
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

  it("Get customer with karibou id", async function() {
    const cust = await customer.Customer.lookup(1234);
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
    config.option('debug',false);
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

    const cust = await customer.Customer.get(custCleanList[0]);
    const pm_update = Object.assign({},pm_valid);
    pm_update.card.exp_year = 2026;
    const pm = await $stripe.paymentMethods.create(pm_update);
    const payment = await cust.addMethod(pm.id);
    payment.expiry.should.equal('8/2026')

  });

  it("Add payments methods using other currency", async function() {

    const cust = await customer.Customer.get(custCleanList[0]);
    const pm_update = Object.assign({},pm_valid);
    pm_update.card.exp_year = 2026;
    const payment = await cust.addMethod('pm_card_fr');
    payment.country.should.equal('FR')
  });

  it("Add cashbalance payments method ", async function() {
    const cust = await customer.Customer.get(custCleanList[0]);
    const cashbalance = await cust.createCashBalance(6,2026);
    cashbalance.issuer.should.equal('cash');
    cashbalance.funding.should.equal('debit');
    dateFromExpiry(cashbalance.expiry).getMonth().should.equal(5);

  });

  it("Update cashbalance payments method ", async function() {
    const cust = await customer.Customer.get(custCleanList[0]);
    const cashbalance = await cust.createCashBalance(7,2026);
    cashbalance.issuer.should.equal('cash');
    cashbalance.funding.should.equal('debit');
    dateFromExpiry(cashbalance.expiry).getMonth().should.equal(6);

  });

  it("Get cashbalance payments method ", async function() {
    const cust = await customer.Customer.get(custCleanList[0]);
    const alias = (crypto_fingerprint(cust.id+cust.uid+'cash'));
    const cashbalance = cust.findMethodByAlias(alias);
    cashbalance.issuer.should.equal('cash');
    cashbalance.funding.should.equal('debit');
  });

  it("List cash balance bank transfer ", async function() {
    const cust = await customer.Customer.get(custCleanList[0]);
    const tx = await cust.listBankTransfer();
    console.log('--- DBG tx',tx)
  });

  

  //
  // 3d secure is always managed from fontend
  xit("Add payments methods throw authenticationRequired", async function() {
    config.option('debug',true);
    const cust = await customer.Customer.get(custCleanList[0]);
    try{
      const payment = await cust.addMethod('pm_card_authenticationRequired');
      should.not.exist(payment);
    }catch(err) {
      console.log('----',err.message)    
      should.exist(err);

    }
  });  

  it("Add payments methods throw ExpiredCard", async function() {
    //config.option('debug',true);
    const cust = await customer.Customer.get(custCleanList[0]);
    const pm = await $stripe.paymentMethods.create(pm_fails);

    try{
      const payment = await cust.addMethod('pm_card_chargeDeclinedExpiredCard');
      should.not.exist(payment);
    }catch(err) {
      err.message.should.containEql('expiré')
      should.exist(err);
    }
  });

  it("Add payments methods throw IncorrectCvc", async function() {
    //config.option('debug',true);
    const cust = await customer.Customer.get(custCleanList[0]);
    const pm = await $stripe.paymentMethods.create(pm_fails);

    try{
      const payment = await cust.addMethod('pm_card_chargeDeclinedIncorrectCvc');
      should.not.exist(payment);
    }catch(err) {
      //console.log('----',err.message)    
      err.message.should.containEql('code de sécurité')
      should.exist(err);
    }
  });

  it("Add payments methods throw chargeDeclined", async function() {
    //config.option('debug',true);
    const cust = await customer.Customer.get(custCleanList[0]);
    const pm = await $stripe.paymentMethods.create(pm_fails);

    try{
      const payment = await cust.addMethod('pm_card_visa_chargeDeclined');
      should.not.exist(payment);
    }catch(err) {
      err.message.should.containEql('La banque a refusée')
      should.exist(err);
    }
  });


  it("List all payment's method return latest method", async function() {
    const now = new Date();
    const cust = await customer.Customer.get(custCleanList[0]);    
    cust.methods.length.should.equal(3);
    cust.methods[0].expiry.should.equal((now.getMonth()+1)+'/2024')
  });

  it("Remove unknown payment's method", async function() {
    const cust = await customer.Customer.get(custCleanList[0]);    
    const alias = (crypto_fingerprint(cust.id+cust.uid+'pouet'));
    const card = cust.findMethodByAlias(alias);

    try{
      await cust.removeMethod(card);
      should.not.exist(true);
    }catch(err) {
      should.exist(err);
    }

  });

  it("Remove cahsbalance payment's method", async function() {
    const cust = await customer.Customer.get(custCleanList[0]);    
    const alias = (crypto_fingerprint(cust.id+cust.uid+'cash'));
    const card = cust.findMethodByAlias(alias);
    await cust.removeMethod(card);
    should.not.exist(cust.findMethodByAlias(alias));
  });

  it("Remove visa payment's method", async function() {
    const cust = await customer.Customer.get(custCleanList[0]);    
    const card = cust.methods[0];

    await cust.removeMethod(card);
    should.not.exist(cust.findMethodByAlias(card.alias));
  });


});
