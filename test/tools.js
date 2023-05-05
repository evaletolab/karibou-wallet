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

  it("sha256 stripe", ()=>{
    const hex = payments.crypto_sha256("sk_test_514n7ggBTMLb4og7PYz1hmiF2a2lXhjf5246V9yUvNJudBvVeYuRwq2VNNtxid57rwem8Hg2WiD8jZVAz9ZZ5vucX00C2Rk7WPp","base64");
    console.log('---',hex)
    // "c2tfdGVzdF9FU0RkYlVUckxvNGU5U0M3dW9RcWxoZDI6"
  })

  it("sha256 should return hex", ()=>{
    const hex = payments.crypto_sha256("Hello World","hex");
    const regex = /[0-9A-Fa-f]{32}/g;
    regex.test(hex).should.equal(true);
    hex.length.should.equal(64);
  })


  it("crypto_fingerprint should return hex", ()=>{
    const hex = payments.crypto_fingerprint("Hello World","hex");
    const regex = /[0-9A-Fa-f]{32}/g;
    regex.test(hex).should.equal(true);
  })  


  
  it("XOR encryp/decrypt crypto_randomToken", ()=>{
    const rand = payments.crypto_randomToken();
    const hex = payments.xor(rand,"test_123456");
    payments.unxor(hex,"test_123456").should.equal(rand);
  })

  //
  // WARNING pm_1N2uD...Qt is not an hex number!
  it("XOR encryp/decrypt with custom pkey", ()=>{
    const hex = payments.xor("pm_1N2uD4BTMLb4og7P1hMi07Qt","test_123456");
    payments.unxor(hex,"test_123456").should.equal('pm_1N2uD4BTMLb4og7P1hMi07Qt');
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
