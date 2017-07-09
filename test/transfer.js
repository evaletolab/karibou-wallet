/**
 * unit tests for transfer module
 * Author: David Pate
 * Date: july 2017
 */

var stripe = require("stripe")("sk_test_7v4G5a18JptIOX2cbYAYMsun");
var account = require("../dist/account");
var customer = require("../dist/customer");
var payments = require("../dist/payments.enum").Payment;
var transaction = require("../dist/transaction");
var transfer = require("../dist/transfer");
var should = require('should');
var test = exports;


describe("Class transfer", function(){
  this.timeout(15000);

  var accCleanList = [];

  var accData = {
    type: 'custom',
    country: 'CH',
    email: 'test_account@email.com',
    legal_entity:{
      first_name:"David",
      last_name:"Pate",
      address: {
        line1:"Avenue peschier 6",
        city:"Genève",
        postal_code:"1206"
      }
    },
    business_name:"Les testeurs fous"
  }

  var sourceData = {
    type: payments.card,
    sourceId: null,
    owner: 'Pate David'
  }

  var accObject = undefined;
  var custObject = undefined;
  var transacObject = undefined;
  var transferObject = undefined;

  before(function(done){
    done()
  });

  after(function (done) {
    var promiseList = [];
    if(accObject !== undefined)
        promiseList.push(stripe.accounts.del(accObject.id));
    if(custObject !== undefined)
        promiseList.push(stripe.customers.del(custObject.id));

    Promise.all(promiseList).then(() => {done()}).catch(done);
  });

  // START TESTING
  it("Transfer creation", function(done) {
    stripe.accounts.create(accData)
      .then((stripeAccount) => account.Account.create(stripeAccount.id))
      .then((acc1) => {
        accObject = acc1;
        return customer.Customer.create("test@email.com","testo","sterone");
      })
      .then((cust1) => {
        custObject = cust1;
        return cust1.addMethod(sourceData, "tok_visa");
      })
      .then(() => {
        transacObject = new transaction.Transaction(custObject,2500,"group test", "Test module transfer");
        return transacObject.auth();
      })
      .then(() => {
        return transacObject.capture();
      })
      .then(() => {
        var dest = [{
          account:accObject,
          amount:1500
        },{
          account:accObject,
          amount:700
        }];
        transferObject = new transfer.Transfer(transacObject,dest);
        transferObject.should.property("transaction");
        transferObject.should.property("dest");
        transferObject.should.property("execute");
        done();
      })
  });

  it("Transfer execution", function(done) {
    transferObject.execute()
    .then(() => {
      transferObject.dest[0].transferId.should.not.equal(undefined);
      transferObject.dest[1].transferId.should.not.equal(undefined);
      done();
    })
  });

  it("Transfer partial refund", function(done) {
    transferObject.refund(accObject,"test partial",350)
    .then(() => {
      transferObject.dest[0].amountRefunded.should.equal(350);
      done();
    })
  });

  it("Transfer full refund", function(done) {
    transferObject.refund(accObject,"test partial")
    .then(() => {
      transferObject.dest[0].amountRefunded.should.equal(1500);
      done();
    })
  });

  it("Transfer full refund of all transfers", function(done) {
    transferObject.refundAll()
    .then(() => {
      transferObject.dest[0].amountRefunded.should.equal(1500);
      transferObject.dest[1].amountRefunded.should.equal(700);
      done();
    })
  });

});
