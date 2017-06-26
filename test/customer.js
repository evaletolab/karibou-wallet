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
    stripeCusid:"cus_AtGotgoAdqWrpg"
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
      custCleanList.push(cust.stripeCusid);
      should.exist(cust);
      cust.should.property('addPayment');
      done();
    }).catch(done);
  });

  it("Construction of the customer with json", function(done) {
    var cust = new customer.Customer(JSON.stringify(jsonCust1));
    should.exist(cust);
    cust.should.property('addPayment');
    done();
  });

  it("Add payments methods using valid informations", function(done) {
    customer.Customer.create("test@email.com","David","Pate").then(function (cust) {
      custCleanList.push(cust.stripeCusid);
      cust.addPayment(sourceData,"tok_visa").then(done).catch(done);
    }).catch(done);
  });

  it("Add payments methods using invalid informations", function(done) {
    customer.Customer.create("test@email.com","David","Pate").then(function (cust) {
      custCleanList.push(cust.stripeCusid);
      cust.addPayment(sourceData, "tok_invalid").then(function () {
        done("Error token invalid not detected");
      }).catch(function (err) {
        should.exist(err);
        done();
      });
    }).catch(done);
  });

  it("List all payments", function(done) {
    customer.Customer.create("test@email.com","David","Pate").then(function (cust) {
      custCleanList.push(cust.stripeCusid);
      var promises = [];

      promises.push(cust.addPayment(sourceData,"tok_visa").catch(done));
      promises.push(cust.addPayment(sourceData,"tok_mastercard").catch(done));

      Promise.all(promises).then(function () {
        cust.getPaymentList().then(function (paymentList) {
          paymentList.length.should.equal(2);
          done();
        }).catch(done);
      }).catch(done);
    }).catch(done);
  });

  it("Remove a payment", function(done) {
    customer.Customer.create("test@email.com","David","Pate").then(function (cust) {
      custCleanList.push(cust.stripeCusid);
      var promises = [];
      var promises2 = [];
      promises.push(cust.addPayment(sourceData,"tok_visa").catch(done));
      promises.push(cust.addPayment(sourceData,"tok_mastercard").catch(done));
      promises.push(cust.addPayment(sourceData,"tok_mastercard").catch(done));

      Promise.all(promises).then(function () {
        cust.getPaymentList().then(function (paymentList1) {
          cust.removePayment(paymentList1[0].id).then(function () {
            cust.getPaymentList().then(function (paymentList2) {
              paymentList2.length.should.equal(2);
              done();
            }).catch(done);
          }).catch(done);
        }).catch(done);
      }).catch(done);
    }).catch(done);
  });

  it("Change customer's source", function(done) {
    customer.Customer.create("test@email.com","David","Pate").then(function (cust) {
      custCleanList.push(cust.stripeCusid);
      var actualSource = "";
      var promises = [];

      promises.push(cust.addPayment(sourceData,"tok_visa").catch(done));
      promises.push(cust.addPayment(sourceData,"tok_mastercard").catch(done));

      Promise.all(promises).then(function () {
        stripe.customers.retrieve(cust.stripeCusid).then(function (custStripe) {
          actualSource = custStripe.default_source;
          cust.getPaymentList().then(function (paymentList1) {

            for (let i in paymentList1) {
              if (actualSource != paymentList1[i].id) {
                cust.setStripePayment(paymentList1[i].id).then(function () {
                  stripe.customers.retrieve(cust.stripeCusid).then(function (custStripe) {
                    actualSource.should.not.be.equal(custStripe.default_source);
                    done();
                  }).catch(done);
                }).catch(done);
                break;
              }
            }

          }).catch(done);
        }).catch(done);
      }).catch(done);
    }).catch(done);

  });

});
