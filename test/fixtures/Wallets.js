var ObjectId = require('mongoose').Schema.Types.ObjectID;
var config = require('../../lib/config');

// 12345 ==> evaleto@gluck.com 
// 12346 ==> evaleto@gmail.com
// 12347 ==> delphine@gmail.com

exports.Wallets=[{    
  id:'1111112',
  apikey:config.option('apikey'),
  description: 'this is a demo wallet',
  email: 'demo@gg.com',
  card:{ 
    last4: '5555',
    number: '4444444444445555',
    expiry: new Date(Date.now()+3600000*24) 
  },
  external_account: {
    name:'Demo Wallet',
    iban:'BE68539007547034'
  },
  transfers_enabled:false,
  transfers: [],
  transactions: [],
  created: new Date(Date.now()-3600000*200),
  updated: new Date(Date.now()-3600000*200),
  balance: 500,
  wid: 'wa_1234567890'
},{
  id:'1111113',
  apikey:config.option('apikey'),
  description: 'this is a demo wallet',
  email: 'hello@gg.com',
  card:{ 
    last4: '8750',
    number: '1805531729538750',
    expiry: new Date('Tue Nov 08 2017 23:59:00 GMT+0100 (CET)') 
  },
  external_account: {
    name:'Demo Wallet',
    iban:'BE68539007547034'
  },
  transfers_enabled:false,
  transfers: [],
  transactions: [],
  created: new Date(),
  updated: new Date(),
  balance: 500,
  wid: 'wa_1234567891'  
}];



