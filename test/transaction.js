/**
 * Unit tests for transaction module
 * Author: David Pate
 * Date: july 2017
 */

var stripe = require("stripe")("sk_test_7v4G5a18JptIOX2cbYAYMsun");
var transaction = require("../dist/transaction");
var customer = require("../dist/customer");
var payments = require("../dist/payments.enum").Payment;
var should = require('should');
var test = exports;


describe("Class transaction", function(){
  this.timeout(8000);

  var sourceData = {
    type: payments.card,
    sourceId: null,
    owner: 'Pate David'
  }

  var custObject = undefined;

  before(function(done){
    done();
  });

  after(function (done) {
    stripe.customers.del(custObject.getId()).then(() => done()).catch(done);
  });

  // START TESTING
  it("Transaction creation", function(done) {
    customer.Customer.create("test@email.com","David","Pate")
    .then((cust) => {
      custObject = cust;
      return cust.addMethod(sourceData,"tok_visa");
    })
    .then(() => {
      var transac1 = new transaction.Transaction(custObject,1000,"test_transac1","Test du module transaction");
      transac1.should.property("cust");
      transac1.should.property("amount");
      transac1.should.property("groupId");
      done();
    }).catch(done);
  });

  it("Transaction authorization", function(done) {
    var transac2 = new transaction.Transaction(custObject,1000,"test_transac2","Test du module transaction");
    transac2.auth().then(() => {
      transac2.should.property("id").not.equal(undefined);
      transac2.should.property("authorized").equal(true);
      done();
    }).catch(done);
  });

  it("Transaction capture", function(done) {
    var transac3 = new transaction.Transaction(custObject,1000,"test_transac3","Test du module transaction");
    transac3.auth()
    .then(() => transac3.capture())
    .then(() => {
      transac3.should.property("captured").equal(true);
      return stripe.charges.retrieve(transac3.id);
    })
    .then((charge) => {
      charge.captured.should.equal(true);
      done();
    }).catch(done);
  });

  it("Transaction cancel", function(done) {
    var transac4 = new transaction.Transaction(custObject,1000,"test_transac4","Test du module transaction");
    transac4.auth()
    .then(() => transac4.cancel())
    .then(() => {
      transac4.should.property("captured").equal(false);
      transac4.should.property("authorized").equal(true);
      transac4.should.property("canceled").equal(true);
      done();
    }).catch(done);
  });

  it("Transaction total refund", function(done) {
    var transac5 = new transaction.Transaction(custObject,1000,"test_transac5","Test du module transaction");
    transac5.auth()
    .then(() => transac5.capture())
    .then(() => transac5.refund())
    .then(() => {
      transac5.should.property("captured").equal(true);
      transac5.should.property("amountRefunded").equal(1000);
      done();
    }).catch(done);
  });

  it("Transaction partial refund", function(done) {
    var transac6 = new transaction.Transaction(custObject,1000,"test_transac6","Test du module transaction");
    transac6.auth()
    .then(() => transac6.capture())
    .then(() => transac6.refund(250))
    .then(() => {
      transac6.should.property("captured").equal(true);
      transac6.should.property("amountRefunded").equal(250);
      done();
    }).catch(done);
  });

  it("Transaction loaded from json", function(done) {
    var transac7 = new transaction.Transaction(custObject,1000,"test_transac7","Test du module transaction");
    transac7.auth()
    .then(() => transac7.capture())
    .then(() => transac7.refund(250))
    .then(() => transaction.Transaction.load(JSON.parse(transac7.save())))
    .then((transac8) => {
      transac8.save().should.equal(transac7.save());
      done();
    })
    .catch(done);
  });

});
