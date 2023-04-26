module.exports = {
  payment:{
    allowMultipleSetOption:true,
    apikey:'123456789',
    currency:'CHF',
    allowedCurrencies:['CHF','US','EU'],
    allowMaxAmount:40000,
    reservedAmount:1.15,
    sandbox:false,
    debug:true,
    shaSecret:'1234',
    stripePrivatekey:"sk_test_514n7ggBTMLb4og7PYz1hmiF2a2lXhjf5246V9yUvNJudBvVeYuRwq2VNNtxid57rwem8Hg2WiD8jZVAz9ZZ5vucX00C2Rk7WPp",
    stripeApiVersion:'2020-08-27'
  }
}
