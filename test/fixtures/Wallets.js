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
    expiry: new Date('Tue Nov 08 2016 23:59:00 GMT+0100 (CET)') 
  },
  external_account: {
    name:'Demo Wallet',
    iban:'BE68539007547034'
  },
  transfers: [],
  transactions: [],
  created: new Date('Mon Nov 09 2015 08:20:21 GMT+0100 (CET)'),
  updated: new Date('Mon Nov 09 2015 08:20:21 GMT+0100 (CET)'),
  balance: 500,
  wid: 'wa_1234567890'
}];



