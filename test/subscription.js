/**
 * Karibou payment wrapper
 * Customer
 */

 const config =require("../dist/config").default;
 const customer = require("../dist/customer");
 const payments = require("../dist/payments").Payment;
 const subscription = require("../dist/subscription.contract");
 const $stripe = require("../dist/payments").$stripe;
 const should = require('should');
 const cartItems = require('./fixtures/cart.items');

 const weekdays = "dimanche_lundi_mardi_mercredi_jeudi_vendredi_samedi".split('_');

describe("Class subscription", function(){
  this.timeout(8000);

  let defaultCustomer;
  let defaultPaymentAlias;
  let defaultSub;

  // start next week
  let dateValid = new Date(Date.now() + 86400000*7);
  let pausedUntil = new Date(Date.now() + 86400000*30);

  const pm_valid = {
    type: 'card',
    card: {
      number: '4242424242424242',
      exp_month: 8,
      exp_year: 2025,
      cvc: '314',
    },
  };
 
  const shipping = {
    streetAdress: 'rue du rhone 69',
    postalCode: '1208',
    name: 'foo bar family',
    price: 5,
    lat:1,
    lng:2
  };


  before(async function(){
    defaultCustomer = await customer.Customer.create("test@email.com","Foo","Bar","022345",1234);
    const pm = await $stripe.paymentMethods.create(pm_valid);
    const card = await defaultCustomer.addMethod(pm.id);
    defaultPaymentAlias = card.alias;
  });

  after(async function () {
    await $stripe.customers.del(defaultCustomer.id);
    //await $stripe.subscriptions.del(defaultSub.id);
  });

  // Simple weekly souscription 
  it("SubscriptionContract create weekly", async function() {
    config.option('debug',true);

    const fees = 0.06;
    const dayOfWeek= 2; // tuesday
    const items = cartItems.slice();

    const card = defaultCustomer.findMethodByAlias(defaultPaymentAlias);
    defaultSub = await subscription.SubscriptionContract.create(defaultCustomer,card,"week",dateValid,shipping,items,dayOfWeek,fees)

    defaultSub.should.property("id");
    defaultSub.should.property("status");
    defaultSub.should.property("shipping");
    defaultSub.should.property("items");
    defaultSub.items.length.should.equal(2);

    // console.log('---- DBG sub',defaultSub.id);
    // console.log('---- DBG sub',defaultSub.description);
    // console.log('---- DBG sub',defaultSub.status);
    // console.log('---- DBG sub',defaultSub.interval);
    //console.log('---- DBG sub',defaultSub.items[0]);
  });

  // Simple weekly souscription 
  it("SubscriptionContract create montly", async function() {
    config.option('debug',true);

    const fees = 0.06;
    const dayOfWeek= 2; // tuesday
    const items = cartItems.slice();

    const card = defaultCustomer.findMethodByAlias(defaultPaymentAlias);
    defaultSub = await subscription.SubscriptionContract.create(defaultCustomer,card,"month",dateValid,shipping,items,dayOfWeek,fees)

    defaultSub.should.property("id");
    defaultSub.should.property("status");
    defaultSub.should.property("shipping");
    defaultSub.should.property("items");
    defaultSub.items.length.should.equal(1);

    // console.log('---- DBG sub',defaultSub.id);
    // console.log('---- DBG sub',defaultSub.description);
    // console.log('---- DBG sub',defaultSub.status);
    // console.log('---- DBG sub',defaultSub.interval);
    // console.log('---- DBG sub',defaultSub.items[0]);
  });

  it("list all SubscriptionContract for one customer", async function() {
    const contracts = await subscription.SubscriptionContract.list(defaultCustomer);
    contracts.length.should.equal(2);
    contracts.forEach(contract=> {
      console.log('\n     ------------------------------- ');
      console.log('-- ',contract.status,contract.description, defaultCustomer.name);
      console.log('-- ',contract.interval);
      console.log('-- ','dayOfWeek '+ contract.shipping.dayOfWeek,contract.shipping.name,contract.shipping.streetAdress,contract.shipping.postalCode);
      contract.items.forEach(item=> {
        console.log('   ',item.title,item.sku,item.quantity * (item.unit_amount/100), 'chf',item.quantity);
      })
    });

  });

  it("pause weekly sub for 30 days", async function() {
    const contracts = await subscription.SubscriptionContract.list(defaultCustomer);
    const contract = contracts.find(contract => contract.interval.bill == 'week');

    should.exist(contract);
    await contract.pause(pausedUntil);
    console.log('\n-- ',contract.status,contract.description,'resumed on',new Date(contract.pausedUntil),'(',(contract.pausedUntil-new Date())/86400000|0,'d)');        
  });

  it("manualy resume paused sub ", async function() {
    const contracts = await subscription.SubscriptionContract.list(defaultCustomer);
    const contract = contracts.find(contract => contract.interval.bill == 'week');

    should.exist(contract);
    await contract.resumeManualy();
    console.log('\n-- ',contract.status,contract.description,defaultCustomer.name, contract.pausedUntil);        
  });


});
