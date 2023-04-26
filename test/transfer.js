/**
 * Karibou payment wrapper
 * Transfer
 */

 const config =require("../dist/config").default;
 const customer = require("../dist/customer");
 const payments = require("../dist/payments").Payment;
 const transaction = require("../dist/transaction");
 const $stripe = require("../dist/payments").$stripe;
 const should = require('should');

describe("Class transfer", function(){
  this.timeout(15000);

  var accCleanList = [];

  var accData = {
    type: 'custom',
    country: 'CH',
    email: 'test_account@email.com',
    legal_entity:{
      first_name:"Bar",
      last_name:"Foo",
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
  xit("Transfer creation", function(done) {
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

  xit("Transfer execution", function(done) {
    transferObject.execute()
    .then(() => {
      transferObject.dest[0].transferId.should.not.equal(undefined);
      transferObject.dest[1].transferId.should.not.equal(undefined);
      done();
    })
  });

  xit("Transfer partial refund", function(done) {
    transferObject.refund(accObject,"test partial refund",350)
    .then(() => {
      transferObject.dest[0].amountRefunded.should.equal(350);
      done();
    })
  });

  xit("Transfer full refund", function(done) {
    transferObject.refund(accObject,"test full refund")
    .then(() => {
      transferObject.dest[0].amountRefunded.should.equal(1500);
      done();
    })
  });

  xit("Transfer full refund of all transfers", function(done) {
    transferObject.refundAll("test refundAll")
    .then(() => {
      transferObject.dest[0].amountRefunded.should.equal(1500);
      transferObject.dest[1].amountRefunded.should.equal(700);
      done();
    })
  });

});
