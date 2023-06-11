/**
 * Karibou payment wrapper
 * Customer
 */

 const config =require("../dist/config").default;
 const customer = require("../dist/customer");
 const payments = require("../dist/payments").Payment;
 const unxor = require("../dist/payments").unxor;
 const card_mastercard_prepaid = require("../dist/payments").card_mastercard_prepaid;
 const subscription = require("../dist/contract.subscription");
 const $stripe = require("../dist/payments").$stripe;
 const should = require('should');
 const cartItems = require('./fixtures/cart.items');


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


//
// stripe test subscription with fake clock 
// https://stripe.com/docs/billing/testing/test-clocks?dashboard-or-api=api
const weekdays = "dimanche_lundi_mardi_mercredi_jeudi_vendredi_samedi".split('_');

describe("Class subscription", function(){
  this.timeout(8000);

  let defaultCustomer;
  let defaultPaymentAlias;
  let defaultSub;



  before(async function(){
    defaultCustomer = await customer.Customer.create("subscription@email.com","Foo","Bar","022345",1234);
    const card = await defaultCustomer.addMethod(unxor(card_mastercard_prepaid.id));
    defaultPaymentAlias = card.alias;

  });

  after(async function () {
    await $stripe.customers.del(unxor(defaultCustomer.id));
    //await $stripe.subscriptions.del(defaultSub.id);
  });

  // Simple weekly souscription 
  xit("SubscriptionContract create weekly receive upcoming message", async function() {
    config.option('debug',true);

    const EVENT_SUCCESS = {
      id: 'invoice.upcoming',
      object: {data:{}},
    };
  
    expect(() => {
      $stripe.webhooks.generateTestHeaderString();
    }).to.throw();    
  });

	

});
