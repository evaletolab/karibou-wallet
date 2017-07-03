/**
 * Daimyo - unit tests for account module
 * Author: David Pate
 * Date: june 2017
 */

var stripe = require("stripe")("sk_test_7v4G5a18JptIOX2cbYAYMsun");
var account = require("../dist/account");
var should = require('should');
var test = exports;


describe("Class account", function(){
  this.timeout(8000);

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

  var accObject = undefined;

  before(function(done){
    done()
  });

  after(function (done) {
    var promiseDelList = [];
    for (let i in accCleanList) {
      if (accCleanList[i] != undefined)
        promiseDelList.push(stripe.accounts.del(accCleanList[i]));
    }

    Promise.all(promiseDelList).then(function() {done()});
  });

  // START TESTING
  it("Construction of the account", function(done) {
    stripe.accounts.create(accData)
      .then((stripeAccount) => account.Account.create(stripeAccount.id))
      .then((acc1) => {
        accObject = acc1;
        accCleanList.push(acc1.id);
        should.exist(acc1);
        acc1.should.property('getTransferList');
        done();
      }).catch(done);
  });

  it("Construction of the account with json", function(done) {
    var acc2 = new account.Account(JSON.parse(accObject.save()));
    accCleanList.push(acc2.id);
    should.exist(acc2);
    acc2.should.property('getTransferList');
    done();
  });

  it("List of transfer", function(done) {
    var promiseList = [];
    stripe.accounts.create(accData)
      .then((stripeAccount) => account.Account.create(stripeAccount.id))
      .then((acc3) => {
        accCleanList.push(acc3.id);
        promiseList.push(stripe.charges.create({
          amount: 2000,
          currency: "chf",
          source: "tok_visa",
          destination: {
            account: acc3.id,
          },
        }));

        promiseList.push(stripe.charges.create({
          amount: 3000,
          currency: "chf",
          source: "tok_visa",
          destination: {
            account: acc3.id,
          },
        }));

        Promise.all(promiseList)
          .then(acc3.getTransferList(10))
          .then((transferList) => {transferList.length.should.equal(2); done();});
      }).catch(done);
    });

});
