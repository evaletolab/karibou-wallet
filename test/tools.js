/**
 * unit tests for the main wallet module
 * psp error: http://docs.openstream.ch/payment-provider/wallet-error-messages/
 */

var assert = require('assert');
var should = require('should');

describe.skip("tools", function(){
  var config = require('../lib/config');
  var tools=require('../lib/tools');



  before(function(done){
    done()
  });



  it("tools.dateFromExpiry", function(done){
    var date=new Date(2017,1,0,23,59,0,0);
    // console.log(date)
    tools.dateFromExpiry('01/2017').getTime().should.equal(date.getTime())
    tools.dateFromExpiry('1/2017').getTime().should.equal(date.getTime())
    tools.dateFromExpiry('1/17').getTime().should.equal(date.getTime())
    tools.dateFromExpiry('1/017').getTime().should.equal(date.getTime())
    done()
  });


});
