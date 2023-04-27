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
    stripePrivatekey:"sk_...p",
    stripeApiVersion:'2020-08-27'
  }
}
