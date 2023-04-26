/**
 * unit tests for the main wallet module
 * psp error: http://docs.openstream.ch/payment-provider/wallet-error-messages/
 */


const config =require("../dist/config").default;
const payments = require("../dist/payments");
const should = require('should');


describe("payment.tools", function(){

  before(function(done){
    done()
  });


  it("XOR encryp/decrypt with custom pkey", ()=>{
    const hex = payments.xor("Hello World","test_123456");
    payments.unxor(hex,"test_123456").should.equal('Hello World');
  })

  it("XOR encryp/decrypt with config pkey", ()=>{
    const hex = payments.xor("Hello World");
    payments.unxor(hex).should.equal('Hello World');
  })

  it("payments.dateFromExpiry", function(done){
    const date=new Date(2017,1,0,23,59,0,0);
    // console.log(date)
    payments.dateFromExpiry('01/2017').getTime().should.equal(date.getTime())
    payments.dateFromExpiry('1/2017').getTime().should.equal(date.getTime())
    payments.dateFromExpiry('1/17').getTime().should.equal(date.getTime())
    payments.dateFromExpiry('1/017').getTime().should.equal(date.getTime())
    done()
  });


});
