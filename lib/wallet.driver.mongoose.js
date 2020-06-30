
var debug = require('debug')('account')
  , config = require('./config')
  , check = require('./check')
  , Money = require('js-money')
  , IBAN = require('iban')
  , _ =require('underscore')
  , fnv=require('fnv-plus')
  , assert = require("assert")
  , mongoose = require('mongoose')
  , tools = require('./tools')
  , Schema = mongoose.Schema
  , Promise = require('bluebird')
  , ObjectId = Schema.ObjectId;
  


//
// private connection
if(config.option('mongo').multiple){
  mongoose=mongoose.createConnection(config.option('mongo').name);
}

//
// https://www.npmjs.com/package/sepa

//
// Promise (mongoose >=4.1)
// http://eddywashere.com/blog/switching-out-callbacks-with-promises-in-mongoose/
var VALID_TRANSACTIONS = [
    'authorize', 
    'capture', 
    'cancel', 
    'refund'
]

var VALID_PREFIX={
  account:'wa_',
  transaction:'ch_',
  transfer:'tr_'
};

//
//
var VALID_TRANSFERS =[
  'debit',
  'credit'
];


//
// this should be included in a lib
var roundCHF=function (value) {
  return parseFloat((Math.round(value*20)/20).toFixed(2))
}

var round2digit=function (value) {
  return parseFloat(value.toFixed(2))
}

//
// this is used to prepare the object signature
function objectToSignature(source) {
  function sortObject(input) {
      if(typeof input !== 'object' ||input===null)
          return input
      var output = {};
       Object.keys(input).sort().forEach(function (key) {
        output[key] = sortObject(input[key]);
      });
      return output;
  }
  var signature={};
  //
  // what about transactions and transfers ??
  // FIXME append 'amount_negative',
  ['balance','card','id','wid','email','apikey'].forEach(function (key) {
    signature[key]=source[key];
  });

  return sortObject(signature);
}


var Wallet = new Schema({
  //
  // this is the id of this wallet
  wid:{type:String,required: true,unique:true},
  signed_wallet:{type:String,select:false},

  //
  // lock wallet during transaction or transfer
  lock:{type:Number,default:0},

  //
  // this is secret key where this wallet lives 
  apikey:{type:String,required: true},

  //
  // authorize negative balance
  amount_negative:{type:Number,default:0},

  //
  // Computed value from all transactions
  balance:Number,

  //
  // creator of this account
  id:{type:Number,required: false, select:true},
  email:{type:String,required: true},
  description:{type:String,required: true},

  //
  // this wallet has also one Card with an expiry date
  // the user can lock it with a private name
  card:{
    last4:{type:String,required:true},
    number:{type:String,required: true},
    expiry:{type:Date,required: true},
    name:String,
    registeredTo:{type:Number}
  },

  //
  // external bank account is used for transfer
  external_account:{
    iban:String,
    bic:String,
    sic:String,
    account:String,
    name:String,
    address1:String,
    address2:String
  },

  //
  // transfer configuration
  transfers_enabled:{type:Boolean,required: true,default:false,select:true},

  // transfer_schedule:{
  //   interval:{type:String,select:false}
  // },

  //
  // transfers
  transfers:[{    
    id:{type:String,required:true,select:false},
    amount:{type:Number,required:true},
    amount_reversed:{type:Number},
    reversed:{type:Boolean,default:false},
    bank:{
      iban:String,
      bic:String,
      sic:String,
      name:String,
      account:String,
    },
    refid:String,
    wallet:{type:String},
    recipient:{type:String,enum:['bank','wallet']},
    application_fee:{type:Number},
    description:{type:String},
    created:{type:Date,default:Date.now},
    logs:[String],
    type:{type:String,enum:VALID_TRANSFERS,required:true}
  }],

  //
  // transactions 
  transactions:[{
    id:{type:String,required:true,select:false},
    amount:{type:Number,required:true},
    description:{type:String},
    amount_refunded:{type:Number},
    application_fee:{type:Number},
    dispute:{type:Boolean},
    created:{type:Date},
    limited:{type:Date},
    logs:[String],
    status:{type:String,enum:VALID_TRANSACTIONS,required:true}
  }],


  created:{type:Date,required:true,default:Date.now},
  updated:{type:Date,required:true,default:Date.now},
  giftcode:{type:Boolean,default:false,select:false},
  available:{type:Boolean,required: true,default:false,select:false}

});

//
// serialisation
Wallet.set('toObject',{
  transform:function (doc,ret,options) {
    delete ret.__v;
    delete ret._id;
    delete ret.apikey;
    delete ret.id;
    delete ret.lock;
    delete ret.signed_wallet;
    delete ret.giftcode;
    // delete ret.transfers_enabled;
    if(!ret.transactions){
      ret.transactions=[];
    }
    for (var i = ret.transactions.length - 1; i >= 0; i--) {
      delete ret.transactions[i].id;
      delete ret.transactions[i]._id;
    }
    if(!ret.transfers){
      ret.transfers=[];
    }
    for (var i = ret.transfers.length - 1; i >= 0; i--) {
      delete ret.transfers[i].id;
      delete ret.transfers[i]._id;
    }

    if(ret.card){
      // important !!
      if(ret.card.registeredTo){
        delete ret.card.number;
        delete ret.card.registeredTo;
      }
    }
    delete ret.available;
    return ret;
  }
});


Wallet.pre('save',function (next) {
    var stringHash=JSON.stringify(objectToSignature(this.toObject()));
    this.signed_wallet=tools.stringHash(config.option('apikey')+stringHash,'base64');
    this.updated=new Date();

    return next();
})

Wallet.methods.verifySign=function function_name () {
  var stringToHash=JSON.stringify(objectToSignature(this.toObject()));
  var stringHash=tools.stringHash(config.option('apikey')+stringToHash,'base64');
  return this.signed_wallet===stringHash;
}

//
// creating a wallet (anonymous, or attached to an user)
Wallet.statics.create = function(options,callback){
  var defer = tools.defer();
  if(callback){defer.addBack(callback);}

  assert(options);
  assert(options.id);
  assert(options.email);
  assert(options.description);
  var Wallet=this, 
      oneYear=new Date(Date.now()+86400000*365*2) ;

  oneYear.setHours(23,59,0,0);

  // mandatory params
  var walletOptions={
    apikey:config.option('apikey'),
    email:options.email,
    description:options.description,
    card:{},
    external_account:{},
    id:options.id,
    amount_negative:options.amount_negative||0
  };

  //
  // generate an account ID // TODO RACE CONDITION
  walletOptions.wid=VALID_PREFIX.account+tools.stringHash(config.option('apikey')+Date.now()+options.id+tools.randomString(6),'base64').replace(/[\/]/g,'Tk');
  walletOptions.card.number=check.mod10gen(fnv.hash(walletOptions.wid,52).dec()+'',{});
  walletOptions.card.last4=walletOptions.card.number.substr(16 - 4);
  walletOptions.card.registeredTo=options.id;

  // parse date or give a default one year
  walletOptions.card.expiry=tools.dateFromExpiry(options.expiry)||oneYear;

  if(options.external_account){
    walletOptions.external_account={};
    ['account','sic','bic','name','address1','address2'].forEach(function (field) {
      if(options.external_account[field]){
        walletOptions.external_account[field]=options.external_account[field];
      }
    });
    if(walletOptions.external_account.iban){
      if(!IBAN.isValid(walletOptions.external_account.iban)){
        return defer.reject(new Error("La référence IBAN n'est pas valide"))
      }
      walletOptions.external_account.iban=options.external_account.iban;
    }
  }

  //
  // dettach the wallet
  if(options.giftcode){
    walletOptions.giftcode=true;
    delete walletOptions.card.registeredTo
  }


  // init the balance
  walletOptions.balance=0;

  //
  // lokking for multiple wallet
  // it's possible for an user to own multiple wallets but not for now!
  this.find({id:walletOptions.id,giftcode:{$ne:true}}).exec().then(function (wallets) {
    if(wallets.length&&!walletOptions.giftcode){
      return defer.reject(new Error("Impossible de créer un comtpe pour cet utilisateur"));
    }

    //
    // ready to create the wallet
    var wallet=new Wallet(walletOptions);   
    return wallet.save();  
  }).then(function (w) {
    //
    // ensure that wallet is always registered!
    options.giftcode||assert.equal(w.card.registeredTo,parseInt(options.id));
    defer.resolve(w.toObject());
  }).then(undefined,function (err) {
    defer.reject(err);
  });  
  return defer.promise;
}; 

//
// Update the details of the account
// - card and external_account
Wallet.statics.update = function (wid,options,callback) {
  var defer = tools.defer();
  if(callback){defer.addBack(callback);}
  assert(wid);
  assert(options);
  var update={
  };

  if(options.name){
    update.card={}
    update.card.name=tools.slug(options.name.toLowerCase());
  }

  //
  // updated bank account
  if(options.external_account){
    update.external_account={};
    ['account','sic','bic','name','address1','address2'].forEach(function (field) {
      if(options.external_account[field]){
        update.external_account[field]=options.external_account[field];
      }
    });
    if(!options.external_account.account&&!IBAN.isValid(options.external_account.iban)){
      defer.reject(new Error("La référence IBAN n'est pas valide"));
      return defer.promise;

    }
    update.external_account.iban=options.external_account.iban;
  }

  //
  // FIXME double SIG validation should be mandatory
  // this.findOneAndUpdate({wid:wid},update,{upset:true, safe:true}
  this.__retrieve({wid:wid},function (err,wallet) {
    if(err){return defer.reject(err);}
    if(update.card)_.extend(wallet.card,update.card);
    if(update.external_account)_.extend(wallet.external_account,update.external_account);

    wallet.save(function (err,wallet) {
      if(err){return defer.reject(err);}
      return defer.resolve(wallet.toObject());
    });

  })
  
  return defer.promise;
}

//
// Update the details of the account
// - card and external_account
Wallet.statics.updateExpiry = function (wid,options,callback) {
  var defer = tools.defer();
  if(callback){defer.addBack(callback);}
  assert(wid);
  assert(options);
  var update={
  };

  //
  // update expiry and name of this card (for admin only)
  if(options.expiry){
    update.card={};
    update.card.expiry=tools.dateFromExpiry(options.expiry);
    if(!update.card.expiry){
      defer.reject(new Error("La date n'est pas valide: "+options.expiry))
      return defer.promise;
    }
  }


  //
  // FIXME double SIG validation should be mandatory
  // this.findOneAndUpdate({wid:wid},update,{upset:true, safe:true}
  this.__retrieve({wid:wid},function (err,wallet) {
    if(err){return defer.reject(err);}
    _.extend(wallet.card,update.card);
    wallet.save(function (err,wallet) {
      if(err){return defer.reject(err);}
      return defer.resolve(wallet.toObject());
    });

  })
  
  return defer.promise;
}

//
// Activate or desactivate this wallet
Wallet.statics.updateAvailable = function (wid,available,callback) {
  var defer = tools.defer();
  if(callback){defer.addBack(callback);}
  assert(wid);
  assert(available);
  
  this.__retrieve({wid:wid},function (err,wallet) {
    if(err){return defer.reject(err);}
    wallet.available=(available===true);
    wallet.save(function (err,wallet) {
      if(err){return defer.reject(err);}
      return defer.resolve(wallet.toObject());
    });

  })
  
  return defer.promise;
}

//
// Activate or desactivate transfer for this wallet
Wallet.statics.updateTransfer = function (wid,available,callback) {
  var defer = tools.defer();
  if(callback){defer.addBack(callback);}
  assert(wid);
  assert(available);
  
  this.__retrieve({wid:wid},function (err,wallet) {
    if(err){return defer.reject(err);}
    wallet.transfers_enabled=(available===true);
    wallet.save(function (err,wallet) {
      if(err){return defer.reject(err);}
      return defer.resolve(wallet.toObject());
    });

  })
  
  return defer.promise;
}
//
// Retrieves a wallet account from a Card object
Wallet.statics.registerWallet = function (wid,card,callback) {
  assert(wid);
  assert(card);
  assert(card.uid);
  assert(card.name);
  assert(card.number);

  var defer = tools.defer(), source, self=this;
  if(callback){defer.addBack(callback);}

  return defer.promise;

};

//
// Transfer the content of an anonymous wallet (GiftCode) 
Wallet.statics.transferGiftcode = function (wid,card,callback) {
  assert(wid);
  assert(card);
  assert(card.name);
  assert(card.number);

  var defer = tools.defer(), source, self=this;
  if(callback){defer.addBack(callback);}

  //
  // TODO lock wallet during the process

  //
  // get the source wallet
  self.__retrieve({wid:wid})
  .then(function (wallet) {
    source=wallet;
    return self.__retrieve({'card.number':card.number});
  })

  //
  // looking for the GIFTCARD wallet
  // .then(function (giftcode) {
  //   if(giftcode.card.registeredTo){
  //     return defer.reject(new Error("The card can not be transfered"));
  //   }
  //   giftcode.card.registeredTo=source.id;
  //   giftcode.card.name=card.name;
  //   return giftcode.save()
  // })

  //
  // tranfert the content to our source wallet
  // first credit our source wallet
  .then(function (giftcode) {
    var transfer={
      amount:giftcode.balance,
      description:'Transfer GIFTCODE to '+source.email,
      type:'debit'
    }
    return self.transfer_create(giftcode.wid,transfer,wid);
  })
  // // then debit our source wallet
  // .then(function (transfer,giftcode) {

  //   var transfer={
  //     amount:transfer.amount,
  //     wallet:giftcode.wid,
  //     description:'Transfer GIFTCODE',
  //     type:'credit'
  //   }
  //   return self.transfer_create(wid,transfer);
  // })
  .then(function (transfer,wallet, recipient) {
    defer.resolve(transfer._data.recipient);
  })

  .then(undefined,function (error) {
    defer.reject(error)
  });

  return defer.promise;
};


//
// this is a private helper for admin tasks on wallet
// this helper can lock the wallet
Wallet.statics.__retrieve=function (query,cb) {
  var defer = tools.defer(), wallet={},self=this;
  if(cb){defer.addBack(cb);}
  _.extend(wallet,query);

  //
  // unlock this wallet
  // TODO we have to chain this defer to avoid *rare* race condition
  var unlock=function () {
    self.findOneAndUpdate(wallet,{$inc: {lock:-1}},{new:true},function (e,w) {
    })
  }
  defer.promise.finally(unlock);

  this.findOneAndUpdate(query,{$inc: {lock:1}}, {new:true })
      .select(' +available +signed_wallet +giftcode +transactions.id +transfers.id')
      .exec(function (err,wallet, more) {

    if(err){return defer.reject(err);}

    if(!wallet){
      // TODO better 
      return defer.reject(new Error("The wallet does not exist"));
    }

    if(wallet.lock>1){
      return defer.reject(new Error("The wallet is already running another task"));      
    }
    //
    // check apikey of this document
    if(config.option('apikey')!==wallet.apikey){
      return defer.reject(new Error("This wallet does not belongs to this instance"))
    }

    if(!wallet.verifySign()){
      return defer.reject(new Error("This wallet is inconsistent (GRAVE)"))

    }
    // //
    // // check available
    // if(!wallet.available){
    //   return defer.reject(new Error("Le service de paiement est incomplet (2)"));
    // }

    if(wallet.balance===undefined||wallet.balance===null){
      return defer.reject(new Error("Le service de paiement est incomplet (3)"));
    }
    // return the wallet here
    return defer.resolve(wallet);
  });
  return defer.promise;
};

//
// Retrieves the details of the account
Wallet.statics.retrieve = function (wid,callback) {
  assert(wid);
  var defer = tools.defer(), query={};
  if(callback){defer.addBack(callback);}


  //
  // FIXME double SIG validation should be mandatory
  this.findOne({wid:wid}).exec(function (err,wallet) {
    if(err){return defer.reject(err);}
    if(!wallet){
      return defer.reject(new Error("The wallet does not exist"));
    }
    //
    // check apikey of this document
    if(config.option('apikey')!==wallet.apikey){
      return defer.reject(new Error("This wallet does not belongs to this instance"))
    }

    return defer.resolve(wallet.toObject());
  });
  return defer.promise;
}


//
// Retrieves one giftcode
Wallet.statics.retrieveOneGift = function (number,callback) {
  var defer = tools.defer(), query={};
  if(callback){defer.addBack(callback);}

  //
  // filter with your apikey
  var apikey=config.option('apikey');

  //TODO should we must pad the number if it's <16 of len?

  this.__retrieve({'card.number':number,apikey:apikey,giftcode:true}).then(function(wallet) {
    if(wallet.card.registeredTo){
      return defer,reject(new Error("Impossible d'afficher cette carte!"));
    }
    return defer.resolve(wallet.toObject());
  }).then(undefined,function (error) {
    defer.reject(error);
  });
  return defer.promise;
}

//
// Retrieves the giftcode
Wallet.statics.retrieveAllGift = function (filter,callback) {
  var defer = tools.defer(), query={};
  if(callback){defer.addBack(callback);}
  //
  // filter with your apikey
  var apikey=config.option('apikey'), 
      query=_.extend({},filter||{},{apikey:apikey,giftcode:true});



  this.find(query).exec(function (err,wallets) {
    if(err){return defer.reject(err);}

    return defer.resolve(wallets.map(function (wallet) {
      return wallet.toObject();
    }));
  });
  return defer.promise;
}

//
// Retrieves the giftcode
Wallet.statics.retrieveAll = function (filter,callback) {
  var defer = tools.defer(), query={};
  if(callback){defer.addBack(callback);}
  //
  // filter with your apikey
  var apikey=config.option('apikey'), 
      query=_.extend({},filter||{},{apikey:apikey,giftcode:false});


  this.find(query).exec(function (err,wallets) {
    if(err){return defer.reject(err);}

    return defer.resolve(wallets.map(function (wallet) {
      return wallet.toObject();
    }));
  });
  return defer.promise;
}


//
// create a transaction with this account
// - transaction [authorize,capture,refund,void]
Wallet.statics.transaction_charge=function(wid,transaction,callback){
  assert(wid);
  assert(transaction);
  assert(transaction.amount);
  assert(transaction.description);


  var defer = tools.defer(), Wallet=this, transactionOptions={};
  if(callback){defer.addBack(callback);}

  var money=new Money(transaction.amount, Money.CHF),
      query={wid:wid},

      //
      // seto default transaction object
      transactionOptions={
        id:VALID_PREFIX.transaction+tools.stringHash(config.option('apikey')+Date.now()+'','base64').replace(/[\/]/g,'Tk'),
        amount:money.amount,
        amount_refunded:0,
        application_fee:null,
        dispute:null,
        currency:money.currency,
        description:transaction.description,
        created:new Date(),
        limited:new Date(Date.now()+86400000*30),
        logs:[],
        status:'authorize'
      };

  this.__retrieve(query,function (err,wallet) {
    if(err){
      return defer.reject(err);      
    }

    //
    // check date
    if(!wallet.card.expiry){
      return defer.reject(new Error("Le service de paiement n'est plus disponible (1)"));
    }

    var ed=new Date(wallet.card.expiry),
        now=new Date();

    if(ed<now){
      return defer.reject(new Error("Le service de paiement n'est plus disponible (2)"));
    }

    // amount should not be negative
    if(transactionOptions.amount<0){
      return defer.reject(new Error("Le montant n'est pas valide"));      
    }

    if(transactionOptions.amount>config.option('allowMaxAmount')){
      return defer.reject(new Error("Les transactions sont limitées à "+config.option('allowMaxAmount')/100+' CHF'));
    }

    if(_.findWhere(wallet.transactions,{id:transactionOptions.id})){
      return defer.reject(new Error("Une erreur grave c'est produite avec le service de paiement (1)"));
    }


    //
    // compute available amount + the negative authorized
    if(!wallet.amount_negative){
        wallet.amount_negative=0;
    }
    var balance=wallet.balance+wallet.amount_negative;
    wallet.transactions.forEach(function (trx) {
      if(trx.status==='authorize' &&trx.limited>transactionOptions.created){
        balance-=trx.amount;
      }
    });

    balance-=transactionOptions.amount;
    //
    // check balance is negative
    if(balance<0){
      return defer.reject(new Error("Le montant sur votre compte est insuffisant !"));
    }

    //
    // capture charge for this wallet
    if(transaction.captured){
      balance=wallet.balance;
      balance-=transactionOptions.amount;
      transactionOptions.status='capture';
      delete transactionOptions.limited;

      //
      // this is a simple check to avoid modification in the database
      wallet.balance=round2digit(balance);
    }

    //
    // log
    transactionOptions.logs.unshift(transactionOptions.status+" "+round2digit(transactionOptions.amount/100)+" CHF at "+transactionOptions.created.toDateString());

    wallet.transactions.unshift(transactionOptions);

    wallet.save(function (err,wallet) {
      if(err){return defer.reject(err);}
      //
      // remove mongoose id
      delete transactionOptions._id;
      // TODO one param for resolve
      transactionOptions._data={wallet:wallet.toObject()};

      return defer.resolve(transactionOptions);
    });
  });


  return defer.promise;
};

//
// refund transaction with this account
Wallet.statics.transaction_capture=function (wid, transaction,callback) {
  assert(wid);
  assert(transaction);
  assert(transaction.id);

  var defer = tools.defer(), now=new Date();
  if(callback){defer.addBack(callback);}


  this.__retrieve({wid:wid},function (err,wallet) {
    if(err){
      return defer.reject(err);      
    }

    //
    // looking for the transaction id
    var trans=_.findWhere(wallet.transactions,{id:transaction.id});
    if(!trans||!trans.id){
      return defer.reject(new Error("La transaction recherchée n'existe pas"));
    }

    if(trans.limited<now){
      return defer.reject(new Error("La transaction n'est plus valide depuis le "+trans.limited));
    }

    if(trans.status!=='authorize'){
      return defer.reject(new Error("Impossible de capturer une transaction avec le status "+trans.status));
    }

    //
    // update the transaction and the balance
    // var balance=Money(wallet.balance,Money.CHF);
    var balance=wallet.balance;

    //
    // amount can only be lower
    if(transaction.amount&&transaction.amount>trans.amount){
      return defer.reject(new Error("Le montant capturé ne peut pas dépasser la somme réservée !"));
    }

    // amount should not be negative
    if(transaction.amount&&transaction.amount<0){
      return defer.reject(new Error("Le montant n'est pas valide"));      
    }

    trans.amount=transaction.amount||trans.amount;
    balance-=trans.amount;

    wallet.balance=round2digit(balance);

    trans.status='capture';

    //
    // log
    trans.logs.unshift(trans.status+" "+round2digit(trans.amount/100)+" CHF at "+now.toDateString());
    wallet.save(function (err,wallet) {
      if(err){return defer.reject(err);}
      //
      // remove mongoose id
      delete trans._id;
      // TODO one param for resolve
      trans._data={wallet:wallet};
      return defer.resolve(trans);
    })
  });

  return defer.promise;
}

//
// refund transaction with this account
Wallet.statics.transaction_refund=function (wid, transaction,callback) {
  assert(wid);
  assert(transaction);
  assert(transaction.id);

  var defer = tools.defer(), now=new Date();
  if(callback){defer.addBack(callback);}


  this.__retrieve({wid:wid},function (err,wallet) {
    if(err){
      return defer.reject(err);      
    }

    //
    // looking for the transaction id
    var trans=_.findWhere(wallet.transactions,{id:transaction.id});
    if(!trans||!trans.id){
      return defer.reject(new Error("La transaction recherchée n'existe pas"));
    }


    if(trans.status!=='capture'){
      return defer.reject(new Error("Impossible de capturer une transaction avec le status "+trans.status));
    }

    if(transaction.amount&&transaction.amount<0){
      return defer.reject(new Error("Le montant n'est pas valide"));      
    }

    if(transaction.amount&& transaction.amount>trans.amount){
      return defer.reject(new Error("Le montant remboursé ne peut pas dépasser la somme capturée !"));
    }

    // refund amount
    trans.amount_refunded=transaction.amount||trans.amount;


    trans.status='refund';

    wallet.balance+=trans.amount_refunded;

    wallet.balance=round2digit(wallet.balance);

    //
    // log
    trans.logs.unshift(trans.status+" "+round2digit(trans.amount_refunded/100)+" CHF at "+now.toDateString());


    wallet.save(function (err,wallet) {
      if(err){return defer.reject(err);}
      //
      // remove mongoose id
      delete trans._id;
      // TODO one param for resolve
      trans._data={wallet:wallet};      
      return defer.resolve(trans);
    })
  });

  return defer.promise;
}

//
// cancel transaction with this account
Wallet.statics.transaction_cancel=function (wid, transaction,callback) {
  assert(wid);
  assert(transaction);
  assert(transaction.id);

  var defer = tools.defer(), now=new Date();
  if(callback){defer.addBack(callback);}


  this.__retrieve({wid:wid},function (err,wallet) {
    if(err){
      return defer.reject(err);      
    }

    //
    // looking for the transaction id
    var trans=_.findWhere(wallet.transactions,{id:transaction.id});
    if(!trans||!trans.id){
      return defer.reject(new Error("La transaction recherchée n'existe pas"));
    }


    if(trans.status!=='authorize'){
      return defer.reject(new Error("Impossible de capturer une transaction avec le status "+trans.status));
    }


    trans.status='cancel';

    //
    // log
    trans.logs.unshift(trans.status+" "+round2digit(trans.amount/100)+" CHF at "+now.toDateString());


    wallet.save(function (err,wallet) {
      if(err){return defer.reject(err);}
      //
      // remove mongoose id
      delete trans._id;
      // TODO one param for resolve
      trans._data={wallet:wallet};
      return defer.resolve(trans);
    })
  });

  return defer.promise;
}

//
// cancel transaction with this account
Wallet.statics.transaction_get=function (wid, transaction_id,callback) {
  assert(wid);
  assert(transaction_id);

  var defer = tools.defer(), now=new Date();
  if(callback){defer.addBack(callback);}


  this.__retrieve({wid:wid},function (err,wallet) {
    if(err){
      return defer.reject(err);      
    }

    //
    // looking for the transaction id
    var trans=_.findWhere(wallet.transactions,{id:transaction_id});
    if(!trans||!trans.id){
      return defer.reject(new Error("La transaction recherchée n'existe pas"));
    }
    //
    // remove mongoose id

    trans._id=undefined;
    delete(trans._id);
    return defer.resolve(trans);
  });

  return defer.promise;
}

//
// create a new transfert with this wallet and 1..N account
//  - credit => account is one BANK
//  - debit  => account is one wallet
//  - debit  => account is N [{wallet,amout}]
Wallet.statics.transfer_create=function (wid, transfer,account,callback) {
  assert(wid);
  assert(transfer);
  assert(account);

  var defer = tools.defer(),when=tools.defer(), now=new Date(),self=this, 
      isCredit=(transfer.type==='credit'),recipient_w;
  if(callback){defer.addBack(callback);}


  var money=new Money(transfer.amount, Money.CHF),

    //
    // seto default transfer object
    transferOption={
      id:VALID_PREFIX.transfer+tools.stringHash(config.option('apikey')+Date.now()+'','base64').replace(/[\/]/g,'Tk'),
      amount:money.amount,
      amount_reversed:0,
      reversed:false,
      application_fee:null,
      currency:money.currency,
      description:transfer.description||'karibou transfer',
      created:new Date(),
      refid:transfer.refid,
      logs:[],
      recipient:'wallet',
      type:transfer.type
    };

  // check transfert account type
  if(isCredit && ((!account.iban&&!account.account)||!account.name)) {
    defer.reject(new Error("La provenance bancaire de votre transfert n'est pas valide"));
    return defer.promise;
  }



  this.__retrieve({wid:wid}).then(function (wallet) {

    //
    // looking for the transfer id
    if(_.findWhere(wallet.transfers,{id:transfer.id})){
      return defer.reject(new Error("Une erreur grave c'est produite avec le service de paiement (2)"));
    }

    if((account.iban||account.account)&&account.name){
      transferOption.recipient='bank';
      transferOption.bank={
        iban:account.iban,
        bic:account.bic,
        sic:account.sic,
        account:account.account,
        name:account.name
      };

      //
      // easy way
      wallet._data={recipient:null};      
      when.resolve(wallet);
      return when.promise;
    }

    // 
    transferOption.wallet=account;
    if(account===wid){
      return defer.reject(new Error("You have to specify a recipient different than your wallet"))        
    }

    //
    // get the wallet contrepart 
    self.__retrieve({wid:account}).then(function(recipient) {
      if(!recipient){
        return when.reject(new Error("Specified recipient doesn't exist"))   // body...        
      }
      // TODO one param for resolve   
      wallet._data={recipient:recipient};
      when.resolve(wallet,recipient);
    });
    return when.promise;

  }).then(function (wallet) {
    var recipient=wallet._data.recipient;
    var recipient_tr=_.extend({},transferOption,{type:'credit'});


    // 
    if(transfer.type==='debit' && (wallet.balance<transfer.amount||wallet.balance===0)){
      return defer.reject(new Error("Le montant sur "+(wallet.giftcode?'la carte':'le compte')+" est insuffisant !"));
    }

    if(transfer.amount<0){
      return defer.reject(new Error("Le montant n'est pas valide"));      
    }

    if(transfer.type==='debit'){
      wallet.balance-=transfer.amount;
    }else{
      wallet.balance+=transfer.amount;      
    }

    // round to 2 digit
    wallet.balance=round2digit(wallet.balance);

    //
    // log
    transferOption.logs.unshift(transferOption.type+" "+round2digit(transferOption.amount/100)+" CHF at "+transferOption.created.toDateString());
    wallet.transfers.unshift(transferOption);

    if(recipient){
      recipient.balance+=transfer.amount;      
      recipient.balance=round2digit(recipient.balance);      
      recipient_tr.logs.unshift(recipient_tr.type+" "+round2digit(recipient_tr.amount/100)+" CHF at "+recipient_tr.created.toDateString());
      recipient.transfers.unshift(recipient_tr);
      return recipient.save().then(function (recipient) {
        recipient_w=recipient.toObject()
        return wallet.save();        
      });
    }


    return wallet.save();
  }).then(function (wallet) {
    // TODO one param for resolve    
    transferOption._data={wallet:wallet.toObject(),recipient:recipient_w};
    return defer.resolve(transferOption);
  }).then(undefined,function (err) {
    return defer.reject(err);      
  });

  return defer.promise;  
}


//
// cancel transfer with this account
Wallet.statics.transfer_cancel=function (wid, transfer,callback) {
  assert(wid);
  assert(transfer);
  assert(transfer.id);

  var defer = tools.defer(), when = tools.defer(), now=new Date(),self=this, transfered, recipient_w;
  if(callback){defer.addBack(callback);}


  this.__retrieve({wid:wid}).then(function (wallet) {

    //
    // looking for the transfer id
    transfered=_.findWhere(wallet.transfers,{id:transfer.id});
    if(!transfered||!transfered.id){
      defer.reject(new Error("Le transfert recherché n'existe pas"));
      return when.promise;
    }

    if(transfered.recipient==='bank'){
      wallet._data={recipient:null};
      when.resolve(wallet);
      return when.promise;
    }

    //
    // get the wallet contrepart 
    self.__retrieve({wid:transfered.wallet}).then(function(recipient) {
      if(!recipient){
        return when.reject(new Error("Specified recipient doesn't exist"))   // body...        
      }
      // TODO one param for resolve      
      wallet._data={recipient:recipient};
      when.resolve(wallet);
    });

    return when.promise;
  }).then(function (wallet) {
    transfered.amount_reversed=transfered.amount_reversed||0;
    transfer.amount=transfer.amount||(transfered.amount-transfered.amount_reversed);


    if((transfered.amount_reversed+transfer.amount)>transfered.amount){
      return defer.reject(new Error("Le montant remboursé ne peut pas dépasser la valeur original de l'ordre !"));
    }


    transfered.amount_reversed+=transfer.amount;
    transfered.reversed=true;

    // reverse credit or debit
    if(transfered.type==='debit'){
      wallet.balance+=transfer.amount;
    }else{
      wallet.balance-=transfer.amount;      
    }

    // round to 2 digit
    wallet.balance=round2digit(wallet.balance);

    //
    // log
    transfered.logs.unshift("Reversed "+transfered.type+" "+round2digit(transfer.amount/100)+" CHF at "+now.toDateString());

    if(wallet._data.recipient){
      // TODO FIXME check if recipient_tr can be Null
      var recipient_tr=_.findWhere(wallet._data.recipient.transfers,{id:transfer.id});

      wallet._data.recipient.balance-=transfer.amount;      
      wallet._data.recipient.balance=round2digit(wallet._data.recipient.balance);      
      recipient_tr.logs.unshift("Reversed "+recipient_tr.type+" "+round2digit(transfer.amount/100)+" CHF at "+now.toDateString());
      return wallet._data.recipient.save().then(function (recipient) {
        recipient_w=recipient.toObject()
        return wallet.save();        
      });
    }

    return wallet.save();

  }).then(function (wallet) {
      // TODO one param for resolve    
      transfered._data={wallet:wallet.toObject(),recipient:recipient_w};    
    return defer.resolve(transfered);
  }).then(undefined,function (err) {
    return defer.reject(err);      
  });

  return defer.promise;
}



Wallet.set('autoIndex', config.option('mongo').ensureIndex);
module.exports =mongoose.model('Wallets', Wallet);


