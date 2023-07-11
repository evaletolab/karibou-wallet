/**
 * Karibou payment wrapper
 * Customer
 */

 const config =require("../dist/config").default;
 const options = require('../config-test');
 config.configure(options.payment);


 const customer = require("../dist/customer");
 const transaction = require("../dist/transaction");
 const payments = require("../dist/payments").KngPayment;
 const unxor = require("../dist/payments").unxor;
 const card_mastercard_prepaid = require("../dist/payments").card_mastercard_prepaid;
 const subscription = require("../dist/contract.subscription");
 const $stripe = require("../dist/payments").$stripe;
 const should = require('should');
 const cartItems = require('./fixtures/cart.items');
const { Webhook,WebhookContent } = require("../dist/webhook");


 //
 // stripe test subscription with fake clock 
 // https://stripe.com/docs/billing/testing/test-clocks?dashboard-or-api=api
 const weekdays = "dimanche_lundi_mardi_mercredi_jeudi_vendredi_samedi".split('_');

describe("Class subscription", function(){
  this.timeout(8000);

  let defaultCustomer;
  let defaultPaymentAlias;
  let defaultSub;
  let defaultTx;

  // start next week
  let dateValid = new Date(Date.now() + 86400000*7);
  let pausedUntil = new Date(Date.now() + 86400000*30);
 
  const shipping = {
    streetAdress: 'rue du rhone 69',
    postalCode: '1208',
    name: 'foo bar family',
    price: 5,
    lat:1,
    lng:2
  };

  const paymentOpts = {
    oid: '01234',
    txgroup: 'AAA',
    shipping: {
        streetAdress: 'rue du rhone 69',
        postalCode: '1208',
        name: 'Cash balance testing family'
    }
  };



  before(async function(){
    defaultCustomer = await customer.Customer.create("subscription@email.com","Foo","Bar","022345",1234);
    const card = await defaultCustomer.addMethod(unxor(card_mastercard_prepaid.id));
    defaultTx = await transaction.Transaction.authorize(defaultCustomer,card,2,paymentOpts)

    defaultPaymentAlias = card.alias;
  });

  after(async function () {
    await $stripe.customers.del(unxor(defaultCustomer.id));
    //await $stripe.subscriptions.del(defaultSub.id);
  });

  // Simple weekly souscription 
  it("SubscriptionContract create weekly", async function() {

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

    // console.log('---- DBG sub',defaultSub);
    // console.log('---- DBG sub',defaultSub.id);
    // console.log('---- DBG sub',defaultSub.description);
    // console.log('---- DBG sub',defaultSub.status);
    // console.log('---- DBG sub',defaultSub.interval);
    //console.log('---- DBG sub',defaultSub.items[0]);
  });

  // Simple weekly souscription 
  it("SubscriptionContract create montly", async function() {

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

  it("SubscriptionContract get default payment method and customer from id", async function() {

    defaultSub = await subscription.SubscriptionContract.get(defaultSub.id)

    defaultSub.should.property("id");
    defaultSub.should.property("status");
    defaultSub.should.property("shipping");
    defaultSub.should.property("items");
    defaultSub.items.length.should.equal(1);

    //
    // verify customer 
    const customer = await defaultSub.customer();
    customer.id.should.equal(defaultCustomer.id);

    //
    // verify payment
    const pid = defaultSub.paymentMethodID;
    const card = customer.findMethodByID(pid);
    should.exist(card);

  });

  it("SubscriptionContract try to remove payment method used from sub", async function() {
    try{
      config.option('debug',false);

      const customer = await defaultSub.customer();
  
      //
      // verify payment
      const pid = defaultSub.paymentMethodID;
      const card = customer.findMethodByID(pid);
      should.exist(card);
      await customer.removeMethod(card);
      should.not.exist(true);
  
    }catch(err) {
      should.exist(err);
      err.message.should.containEql('Impossible de supprimer');

    }
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
    contract.status.should.equal('active');
    // console.log('\n-- ',contract.status,contract.description,defaultCustomer.name, contract.pausedUntil);        
  });



  //
  // testing webhook
  // https://github.com/stripe/stripe-node/blob/master/README.md#testing-webhook-signing
  // https://stripe.com/docs/billing/subscriptions/webhooks#payment-failures
  // customer.subscription.paused	
  // customer.subscription.resumed
  // customer.subscription.trial_will_end	
  // payment_intent.created	
  // payment_intent.succeeded	
  // invoice.payment_failed
  // invoice.upcoming

  // Simple weekly souscription 
  it("Webhook.stripe invoice.upcoming", async function() {
    config.option('debug',true);
    const EVENT_upcoming = {
      type: 'invoice.upcoming',
      data: {object:{
        subscription:defaultSub.id
      }}      
    };
    try{
      const content = await Webhook.stripe(EVENT_upcoming,'hello');
      content.contract.id.should.equal(defaultSub.id);
      content.error.should.equal(false);      
    }catch(err) {
      console.log('---ERR',err.message)
    }
  });
	

  it("Webhook.stripe invoice.payment_failed", async function() {
    config.option('debug',true);
    const EVENT_payment_failed = {
      type: 'invoice.payment_failed',
      data: {object:{
        subscription:defaultSub.id,
        payment_intent: defaultTx.id
      }}      
    };
    try{
      const content = await Webhook.stripe(EVENT_payment_failed,'hello');
      content.contract.id.should.equal(defaultSub.id);
      content.transaction.id.should.equal(defaultTx.id);
      content.error.should.equal(true);      
    }catch(err) {
      console.log('---ERR',err.message)
    }
  });
	

  it("Webhook.stripe invoice.payment_succeeded", async function() {
    config.option('debug',true);
    const EVENT_payment_succeeded = {
      type: 'invoice.payment_succeeded',
      data: {object:{
        subscription:defaultSub.id,
      }}      
    };
    try{
      const content = await Webhook.stripe(EVENT_payment_succeeded,'hello');
      content.contract.id.should.equal(defaultSub.id);
      content.error.should.equal(false);      
    }catch(err) {
      console.log('---ERR',err.message)
    }
  });
	  

});
