/**
 * Daimyo - unit tests for customer module
 * Author: David Pate
 * Date: june 2017
 */

var stripe = require("stripe")("sk_test_7v4G5a18JptIOX2cbYAYMsun");
var customer = require("../dist/customer");
var payments = require("../dist/payments.enum").Payment;
var should = require('should');
var test = exports;


describe("Class customer", function(){
  this.timeout(8000);

  var custCleanList = [];

  var sourceData = {
    type: payments.card,
    sourceId: null,
    owner: 'Pate David'
  }

  var jsonCust1 = {
    email:"test@email.com",
    lastname:"Pate",
    firstname:"David",
    id:"cus_AtGotgoAdqWrpg"
  };

  before(function(done){
    done()
  });

  after(function (done) {
    var promiseDelList = [];
    for (let i in custCleanList) {
      if (custCleanList[i] != undefined)
        promiseDelList.push(stripe.customers.del(custCleanList[i]));
    }

    Promise.all(promiseDelList).then(function() {done()});
  });

  // START TESTING
  it("Construction of the customer", function(done) {
    customer.Customer.create("test@email.com","David","Pate").then(function (cust) {
      custCleanList.push(cust.id);
      should.exist(cust);
      cust.should.property('addMethod');
      done();
    }).catch(done);
  });

  it("Construction of the customer with json", function(done) {
    var cust = new customer.Customer(JSON.stringify(jsonCust1));
    should.exist(cust);
    cust.should.property('addMethod');
    done();
  });

  it("Add payments methods using valid informations", function(done) {
    customer.Customer.create("test@email.com","David","Pate").then(function (cust) {
      custCleanList.push(cust.id);
      cust.addMethod(sourceData,"tok_visa").then(done).catch(done);
    }).catch(done);
  });

  it("Add payments methods using invalid informations", function(done) {
    customer.Customer.create("test@email.com","David","Pate").then(function (cust) {
      custCleanList.push(cust.id);
      cust.addMethod(sourceData, "tok_invalid").then(function () {
        done("Error token invalid not detected");
      }).catch(function (err) {
        should.exist(err);
        done();
      });
    }).catch(done);
  });

  it("List all payment's method", function(done) {
    customer.Customer.create("test@email.com","David","Pate").then(function (cust) {
      custCleanList.push(cust.id);
      var promises = [];

      promises.push(cust.addMethod(sourceData,"tok_visa").catch(done));
      promises.push(cust.addMethod(sourceData,"tok_mastercard").catch(done));

      Promise.all(promises)
        .then(() => cust.getMethodList())
        .then((p1) => {p1.length.should.equal(2);done();});
    }).catch(done);
  });

  it("Remove a payment's method", function(done) {
    customer.Customer.create("test@email.com","David","Pate").then(function (cust) {
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

  it("Change customer's source", function(done) {
    customer.Customer.create("test@email.com","David","Pate").then(function (cust) {
      custCleanList.push(cust.id);
      var actualSource = "";
      var promises = [];

      promises.push(cust.addMethod(sourceData,"tok_visa").catch(done));
      promises.push(cust.addMethod(sourceData,"tok_mastercard").catch(done));

      Promise.all(promises)
        .then(() => stripe.customers.retrieve(cust.id))
        .then((custStripe1) => {actualSource = custStripe1.default_source;
                                return cust.getMethodList()})
        .then((p1) => {for (let i in p1) {
                          if (actualSource != p1[i].id)
                              return cust.setStripeMethod(p1[i].id);
                      }})
        .then(() => stripe.customers.retrieve(cust.id))
        .then((custStripe2) => {actualSource.should.not.be.equal(custStripe2.default_source);
                                done();});
    }).catch(done);

  });

});
