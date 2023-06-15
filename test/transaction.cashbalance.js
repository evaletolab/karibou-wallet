/**
 * Karibou payment wrapper
 * Customer
 */

 const config =require("../dist/config").default;
 const options = require('../config-test');
 config.configure(options.payment);

 const customer = require("../dist/customer");
 const payments = require("../dist/payments").KngPayment;
 const transaction = require("../dist/transaction");
 const $stripe = require("../dist/payments").$stripe;
 const unxor = require("../dist/payments").unxor;
 const should = require('should');


describe("Class transaction with cashbalance", function(){
  this.timeout(8000);

  const cahsbalanceCustomerId = "cus_NoueLwVzjYPhUk";
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
        name: 'Cash balance testing family'
    }
  };


  before(function(done){
    done();
  });

  after(async function () {
    // could not delete a customer with as cashbalance account
    //await $stripe.customers.del(defaultCustomer.id);
  });
  it("Get customer with cashbalance for testing transaction", async function(){
    const now = new Date();
    config.option('debug',false);
    defaultCustomer = await customer.Customer.get(cahsbalanceCustomerId);

    //
    // create uniq cashbalance for this user
    const card = await defaultCustomer.createCashBalance(5,now.getFullYear()+4);
    should.exist(card);
    should.exist(defaultCustomer.cashbalance.available)
    should.exist(defaultCustomer.cashbalance.available.eur)

    defaultPaymentAlias = card.alias;

  });

  //
  // Simulate a bank transfer using the Stripe API
  // curl https://api.stripe.com/v1/test_helpers/customers/{{CUSTOMER_ID}}/fund_cash_balance \
  // -X POST \
  // -u sk_test_ESDdbUTrLo4e9SC7uoQqlhd2: \
  // -d "reference"="REF-4242" \
  // -d "amount"="1000" \
  // -d "currency"="eur"
  it("Ensure that customer have always 100 eur in cash balance", async function() {
    try{

      defaultCustomer = await customer.Customer.get(defaultCustomer.id);
      const amount = 10000 - (defaultCustomer.cashbalance.available.eur*100);
      if(amount<2) {
        return;
      }
      const transfer = await $stripe.testHelpers.customers.fundCashBalance(
        unxor(defaultCustomer.id),
        {amount, currency: 'eur'}
      );      
      defaultTXtoRefund = transfer.id
      transfer.ending_balance.should.equal(10000)
    }catch(err) {
      console.log('----- err',err);  
    }
  });


  it("Transaction create with insufisant fund throw an error", async function() {
    try{
      const card = defaultCustomer.findMethodByAlias(defaultPaymentAlias);
      const tx = await transaction.Transaction.authorize(defaultCustomer,card,101,paymentOpts)
      should.not.exist(tx);
    }catch(err) {
      err.message.should.containEql('balance is insufficient to complete the payment')
      should.exist(err);
    }
  });  


  //
  // https://stripe.com/docs/payments/bank-transfers/accept-a-payment?platform=api&invoices=without#web-create-and-confirm-payment-intent
  it("Transaction with creditcreate with insufisant fund throw an error", async function() {
    try{
      const card = defaultCustomer.findMethodByAlias(defaultPaymentAlias);
      const tx = await transaction.Transaction.authorize(defaultCustomer,card,101,paymentOpts)
      should.not.exist(tx);
    }catch(err) {
      err.message.should.containEql('balance is insufficient to complete the payment')
      should.exist(err);
    }
  });  



  // START TESTING
  it("Transaction create valid cashbalance authorization", async function() {

    // load card from default customer
    const card = defaultCustomer.findMethodByAlias(defaultPaymentAlias);

    const tx = await transaction.Transaction.authorize(defaultCustomer,card,2,paymentOpts)
    tx.should.property("amount");
    tx.authorized.should.equal(true);
    tx.amount.should.equal(2);
    tx.status.should.equal('prepaid');
    tx.requiresAction.should.equal(false);
    tx.captured.should.equal(false);
    tx.canceled.should.equal(false);
    tx.refunded.should.equal(0);
    should.exist(tx._payment.shipping);

    should.exist(tx.report.log);
    should.exist(tx.report.transaction);

    //console.log('---- DBG report',tx.report);

    defaultTX = tx.id;
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
    const tx = await transaction.Transaction.get(defaultTX);
    await tx.capture(1.0);
    tx.amount.should.equal(2);
    tx.authorized.should.equal(false);
    tx.captured.should.equal(true);
    tx.canceled.should.equal(false);
    tx.status.should.equal('refunded');
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


  // FIXME cashbalance consolidation is not available
  xit("Cash balance is correctly consolidated ", async function() {
    defaultCustomer = await customer.Customer.get(defaultCustomer.id);
    defaultCustomer.cashbalance.available.eur.should.equal(98);
  });


  it("List cash balance bank transfer ", async function() {
    const cust = await customer.Customer.get(defaultCustomer.id);
    const tx = await cust.listBankTransfer();
    // console.log('--- DBG tx',tx)
    should.exist(tx);
    should.exist(tx.length);    
  });


  it("Create new Transaction to empty the cashbalance account  ", async function() {

    // load card from default customer
    const card = defaultCustomer.findMethodByAlias(defaultPaymentAlias);
    const tx = await transaction.Transaction.authorize(defaultCustomer,card,98,paymentOpts)
    should.exist(tx);

    defaultCustomer = await customer.Customer.get(defaultCustomer.id);
    // console.log('--- DBG cash',defaultCustomer.cashbalance);
    defaultCustomer.cashbalance.available.eur.should.equal(0);


  });
    

});
