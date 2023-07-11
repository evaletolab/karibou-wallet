import { strict as assert } from 'assert';
import Stripe from 'stripe';
import { $stripe, stripeParseError, crypto_randomToken, crypto_fingerprint, xor, unxor, 
         KngPayment, KngPaymentAddress, KngCard, CashBalance, CreditBalance, dateFromExpiry, parseYear } from './payments';
import Config, { nonEnumerableProperties } from './config';

//
// using memory cache limited to 1000 customer in same time for 4h
const cache = new (require("lru-cache").LRUCache)({ttl:1000 * 60 * 60 * 4,max:1000});
const locked = new (require("lru-cache").LRUCache)({ttl:2000,max:1000});

export class Customer {

  private _sources:Stripe.Card[]|any;
  private _id:string;
  private _metadata:any;
  private _cashbalance:any;
  private _balance: number;

  //
  // phone or email share the same role of identity
  private _email:string;
  private _phone:string;
  private _fname:string;
  private _lname:string;  

  //
  // mapped with backend
  private _uid:string;

  //
  // collected from metadata
  private _addresses:KngPaymentAddress[];

  /**
   * ## customer(id,email,displayName,uid)
   * @param  customer created by Stripe
   * @constructor
   */
  private constructor(id:string,email:string, phone: string, cashbalance:any, balance:number, metadata:any) {
    assert(id);
    assert(email);
    assert(metadata.uid);
    assert(metadata.fname);
    assert(metadata.lname);
    
    this._balance = balance;
    this._email = email;
    this._phone = phone ||'';
    this._fname = metadata.fname;
    this._lname = metadata.lname;
    this._uid = metadata.uid+'';
    this._id = (id+'');
    this._metadata = metadata;
    this._cashbalance = cashbalance||{};

    //
    // when loading existant customer
    this._sources = [];
    this._addresses = parseAddress(metadata);

    //
    // put this new customer in cache 4h
    cache.set(this._uid,this.id);
    cache.set(this.id,this);

    //
    // secure this content from serialization
    nonEnumerableProperties(this);
  }

  //
  // Stripe id must be stable over time, this why we dont use xor(_id)
  get id() {
    return xor(this._id);
  }
  
  get email() {
    return this._email;
  }

  //
  // balance can be coupled with Card or Cashbalance
  get balance() {
    return this._balance/100;
  }
  
  get phone() {
    return this._phone;
  }

  get name() {
    return {
      familyName:this._lname,
      givenName:this._fname
    };
  }

  get uid() {
    return this._uid;
  }

  get addresses() {
    return this._addresses.slice();
  }

  get methods() {
    return this._sources.slice();
  }

  get cashbalance() {
    if(this._cashbalance.available){
      const available = Object.assign({},this._cashbalance.available);
      const balance = Object.assign({},this._cashbalance,{
        available
      });
  
      const currency = Object.keys(balance.available)[0];
      balance.available[currency] = balance.available[currency]/100
      balance['currency']=currency;
      return balance;
    }
    return this._cashbalance;
  }

  // 
  // avoid reentrency
  lock(api){
    const islocked = locked.get(this.id+api)
    if (islocked){
      throw new Error("reentrancy detection");
    }
    locked.set(this.id+api,true);
  }

  unlock(api) {
    locked.delete(this.id+api);
  }

  //
  // search api
  // https://stripe.com/docs/search
  static async allWithActiveCreditbalance(){
    const customer = await $stripe.customers.search({
      query: "-metadata['creditbalance']:null",
    });
  }

  static async search(query){
    const customers = await $stripe.customers.search({
      query: `phone~'${query}' OR name~'${query}' OR email~'${query}'`
    });

    const defaultUser = Object.assign({},{
      phone:'0225550000',
      cash_balance:0,
      balance:0,
      metadata:{uid:'0',fname:'foo',lname:'bar'}
    });
    
    return customers.data.filter(stripe => !!stripe.email).map(stripe => {
      const merged = Object.assign({},defaultUser,stripe);
      merged.metadata = Object.assign({},defaultUser.metadata,stripe.metadata)
      return new Customer(
        merged.id,
        merged.email,
        merged.phone,
        merged.cash_balance,
        merged.balance,
        merged.metadata
      )
    });
  }

  /**
  * ## customer.create()
  * Async constructor of customer
  * @returns a new Customer 
  */
  static async create(email:string, fname:string, lname:string, phone: string, uid:string) {
    try{
      const stripe = await $stripe.customers.create({
        description: fname + ' ' + lname + ' id:'+uid,
        email: email,
        name: fname + ' ' + lname,
        phone,
        metadata: {uid,fname, lname},
        expand: ['cash_balance']
      });  

      return new Customer(stripe.id,email,phone,stripe.cash_balance,0,stripe.metadata); 
    }catch(err) {
      throw parseError(err);
    } 


    // try{

    // }catch(err) {
    //   throw parseError(err);
    // } 
  }
      
  /**
  * ## customer.lookup() from customer in cache (should not be async)
  * @returns a Customer instance from LRU-cache
  */
   static lookup(uid) {
    // stringify
    uid=uid+'';

    //
    // lookup for karibou.ch as customer or pointer of customer
    const customer = cache.get(uid)||cache.get(xor(uid));
    if(customer && customer.id) {
      return customer;
    }

    //
    // lookup verify as pointer of stripe customer
    return cache.get(customer) as Customer;
   }


  /**
  * ## customer.get()
  * @returns a Customer instance with all private data in memory
  */
  static async get(id) {
    if(typeof id == 'string') {
      const cached = Customer.lookup(id) as Customer;
      if(cached){
        return cached;
      }  
    }

    try{
      //
      // safe mock for basics testing
      const stripeMock = (Config.option('sandbox') && id.stripeMock);
      const stripe_id = (id.indexOf&&id.indexOf('cus_')>-1) ? id:unxor(id);
      const stripe = stripeMock || (await $stripe.customers.retrieve(stripe_id,{expand: ['cash_balance']})) as any;
      const customer = new Customer(
        stripe.id,
        stripe.email,
        stripe.phone,
        stripe.cash_balance,
        stripe.balance,
        stripe.metadata
      ); 
      if(!stripeMock){
        await customer.listMethods();
      }
      return customer;
    }catch(err) {
      throw parseError(err);
    } 
  }

  async addressAdd(address: KngPaymentAddress) {
    assert(this._metadata.uid);
    assert(this._metadata.fname);
    assert(this._metadata.lname);
    const _method = 'addaddress';
    try{
      this.lock(_method);

      const keys = metadataElements(this._metadata,'addr');
      address.id = 'addr-' + keys.length + 1;
      this._metadata[address.id] = JSON.stringify(address,null,0);
      const customer = await $stripe.customers.update(
        this._id,
        {metadata: this._metadata, expand: ['cash_balance']}
      );
      
      this._metadata = customer.metadata;
      this._addresses = parseAddress(customer.metadata);  

      //
      // put this new customer in cache 4h
      cache.set(this.id,this);
      this.unlock(_method);
      return Object.assign({},address);
    }catch(err) {
      this.unlock(_method);
      throw parseError(err);
    }     
  }

  async addressRemove(address: KngPaymentAddress) {
    assert(this._metadata.uid);
    assert(this._metadata.fname);
    assert(this._metadata.lname);
    assert(this._metadata[address.id]);

    try{
      this._metadata[address.id] = null;
      const customer = await $stripe.customers.update(
        this._id,
        {metadata: this._metadata, expand: ['cash_balance']}
      );
      
      this._metadata = customer.metadata;
      this._addresses = parseAddress(customer.metadata); 
      //
      // put this new customer in cache 4h
      cache.set(this.id,this);

    }catch(err) {
      throw parseError(err);
    }     
  }

  async addressUpdate(address: KngPaymentAddress) {
    assert(this._metadata.uid);
    assert(this._metadata.fname);
    assert(this._metadata.lname);
    assert(this._metadata[address.id]);

    try{
      this._metadata[address.id] = JSON.stringify(address,null,0);
      const customer = await $stripe.customers.update(
        this._id,
        {metadata: this._metadata, expand: ['cash_balance']}
      );
      
      this._metadata = customer.metadata;
      this._addresses = parseAddress(customer.metadata);  
      //
      // put this new customer in cache 4h
      cache.set(this.id,this);

    }catch(err) {
      throw parseError(err);
    }     
  }  

  /**
  * ## customer.addMethodIntent()
  * Intent to add a new method of payment (off_session) to the customer
  * @returns the payment Intent object
  */
  async addMethodIntent() {
    return await $stripe.setupIntents.create({
      usage:'off_session',
    });
  }


  /**
  * ## customer.addMethod()
  * attach method of payment to the customer
  * - https://stripe.com/en-gb-ch/guides/payment-methods-guide
  * - https://stripe.com/docs/payments/wallets
  * - https://stripe.com/docs/connect/crypto-payouts
  * - https://stripe.com/docs/billing/customer/balance
  * @returns the payment method object
  */
  async addMethod(token:string) {
    const _method = 'addmethod';

    try{
      this.lock(_method);
      const method:any = await $stripe.paymentMethods.attach(token,{customer:this._id});
      if(method.status == "requires_action") {
        //
        // 3D secure is fully managed by the frontend ()
        //
        throw new Error('addMethod requires_confirmation');
      }
      const card = parseMethod(method);

      //
      // replace payment method if old one already exist (update like)
      const exist = this._sources.findIndex(method => card.alias == method.alias )
      if(exist>-1) {
        //
        // FIXME cannot remove payment used by an active subscription
        await $stripe.paymentMethods.detach(unxor(this._sources[exist].id));
        this._sources[exist] = card;
      } else {
        this._sources.push(card);
      }

      //
      // put this new customer in cache 4h
      cache.set(this.id,this);
      this.unlock(_method);

      return card;
    }catch(err) {
      this.unlock(_method);
      throw parseError(err);
    } 
  }


  //
  // update customer balance with coupon code
  async applyCoupon(code:string) {
    const _method = 'appcoupon';

    this.lock(_method);
    const coupon = await $stripe.coupons.retrieve(
      code
    );


    const amount = coupon.amount_off;
    const validity = new Date(coupon.created*1000 + (coupon.duration_in_months||12)*32*86400000);
    if (validity.getTime()<Date.now()){
      throw new Error("Le coupon n'est plus valide, merci de bien vouloir nous contacter");
    }

    if(!amount || amount<0) {
      this.unlock(_method);
      throw new Error("le coupon ne contient pas de crédit");
    }

    //
    // it's more safe to remove code 
    await $stripe.coupons.del(code);

    await this.updateCredit(amount/100);
    this.unlock(_method);
    return this;
  }

  //
  // check if a payment method is valid
  // FIXME: missing test for checkMethods(addIntent:boolean)
  async checkMethods(addIntent:boolean) {

    // 
    // make sure that we get the latest
    const methods = await this.listMethods();
    const result:any = {
      intent: false
    };

    //
    // only for 3d secure 
    if(addIntent) {
      result.intent = await this.addMethodIntent();
    }

    //
    // last day of the month
    const thisMonth = new Date();
    thisMonth.setDate(0);

    for (const method of methods){
      const id = unxor(method.id);
      const alias = unxor(method.alias);
      if(!id || !alias) {
        result[method.alias] = {error : "La méthode de paiement n'est pas compatible avec le service de paiement", code: 1};
        continue;
      }
      const card = this.findMethodByAlias(method.alias);
      if(!card){
        result[method.alias] = {error : "La méthode de paiement n'existe pas", code: 2};
        continue;
      }
      if(dateFromExpiry(card.expiry)<thisMonth) {
        result[method.alias] = {error : "La méthode de paiement a expirée", code: 3};
        continue;

      }

      result[method.alias] = {
        issuer:card.issuer,
        expiry:card.expiry
      };

    }  

    return result;
  }

  //
  // A customer’s credit balance represents internal funds that they can use for futur payment. 
  // If positive, the customer has an amount owed that will be added to their next invoice. 
  // If negative, the customer has credit to apply to their next payment. 
  // Only admin user can update the available credit value
  async allowCredit(allow:boolean, month?:string,year?:string) {

    const fingerprint = crypto_fingerprint(this.id+this.uid+'invoice');
    const id = crypto_randomToken();
    const mo = parseInt(month||'1');
    if(mo<1 || mo>12 ){
      throw new Error("Incorret month params")
    }
    
    let creditbalance:CreditBalance;
    if(allow) {
      year = parseYear((year||'2030')+'')
      creditbalance = {
        type:KngPayment.credit,
        id:xor(id),
        alias:(fingerprint),
        expiry:(month||'12') +'/'+ (year),
        funding:'credit',
        issuer:'invoice',
        limit:Config.option('allowMaxCredit')
      }
  
  
  
      //
      // expose Credit Balance to this customer
      this._metadata['creditbalance'] = JSON.stringify(creditbalance,null,0);
  
      //
      // this is the signature of an credit authorization
      this._sources.push(creditbalance);


    }else {
      this._metadata['allowCredit'] = null;
      this._metadata['creditbalance'] = null;
      const index:number= this._sources.findIndex(src => src.issuer == 'invoice');
      if(index>-1){
        this._sources.splice(index,1);
      }
    }

    const customer = await $stripe.customers.update(
      this._id,
      {metadata: this._metadata}
    );

    //
    // put this new customer in cache 4h
    cache.set(this.id,this);

    //
    // return credit card when it exist
    return creditbalance;
  }


  //
  // A customer’s cash balance represents funds that they can use for futur payment. 
  // By default customer dosen't have access to his cash balance
  // We can activate his cash balance and also authorize a amount of credit 
  // that represents liability between us and the customer.
  async createCashBalance(month:string,year:string):Promise<CashBalance>{
    const fingerprint = crypto_fingerprint(this.id+this.uid+'cash');
    const id = crypto_randomToken();
    const mo = parseInt(month);
    if(mo<1 || mo>12 ){
      throw new Error("Incorret month params")
    }
    //
    // if cash balance exist, a updated one is created

    // if(this._metadata['cashbalance']) {
    //   throw new Error("Cash balance already exist");
    // }

    const cashbalance:CashBalance = {
      type:KngPayment.balance,
      id:xor(id),
      alias:(fingerprint),
      expiry:month+'/'+year,
      funding:'debit',
      issuer:'cash'
    }

    //
    // expose Cash Balance to this customer
    this._metadata['cashbalance'] = JSON.stringify(cashbalance,null,0);
    const customer = await $stripe.customers.update(
      this._id,
      {metadata: this._metadata,expand:['cash_balance']}
    );

    this._cashbalance = customer.cash_balance ||{};
    this._metadata = customer.metadata;
    this._addresses = parseAddress(customer.metadata);  

    const index = this._sources.findIndex(card => card.alias == (cashbalance.alias));;
    if(index>-1){
      this._sources[index]=cashbalance;
    }else{
      this._sources.push(cashbalance);
    }

    //
    // put this new customer in cache 4h
    cache.set(this.id,this);

    return cashbalance;
  }

  async listBankTransfer(){
    //
    // the installed versions of stripe and @type/stripe doesn't support the 
    // API listCashBalanceTransactions, I have to add it
    (<any>$stripe.customers).listCashBalanceTransactions = Stripe.StripeResource.method({
      method: 'GET',
      path: '/{customer}/cash_balance_transactions',
      methodType: 'list',
    });
    const cashBalanceTransactions = await (<any>$stripe.customers).listCashBalanceTransactions(
      (this._id),
      {limit: 15}
    );    

    return cashBalanceTransactions.data;
  }

  /**
  * ## customer.listMethods()
  * List of all the payment's method of the customer
  * @returns {any[]} return the list of available methods
  */
  async listMethods() {
    try{
      this._sources = await $stripe.paymentMethods.list({
        customer:this._id,
        type:'card'
      });  
      this._sources = this._sources.data.map(parseMethod);

      //
      // cashbalance
      const cashbalance = this._metadata['cashbalance'];
      if(cashbalance) {
        const payment = JSON.parse(cashbalance) as CashBalance;
        this._sources.push(payment);        
      }

      //
      // credit customer
      const creditbalance = this._metadata['creditbalance'];
      if(creditbalance) {
        const payment = JSON.parse(creditbalance) as CreditBalance;
        payment.limit = payment.limit ? parseFloat(payment.limit+''):0;

        this._sources.push(payment);        
      }

      //
      // put this new customer in cache 4h
      cache.set(this.id,this);
      return this._sources.slice();


    }catch(err){
      throw parseError(err);
    }
  }

  /**
  * ## customer.removeMethod()
  * Remove a payment's method of the customer
  * @param {string} paymentId Stripe id of the source
  * @returns {any} Promise on deletion of the source
  */
  async removeMethod(method:KngCard) {
    try{
      if(!method || !method.id) {
        throw new Error("La méthode de paiement n'est pas valide");
      }
      const index:number= this._sources.findIndex(src => src.id == method.id);

      if (index == -1) {
        throw new Error("Source ID not found:"+method.id);
      }

      const card_id = unxor(method.id);

      const subs = await $stripe.subscriptions.list({
        customer:this._id
      });      

      //
      // verify if payment is used 
      const payment_used = subs.data.some(sub => sub.default_payment_method = card_id)
      if(payment_used) {
        throw new Error("Impossible de supprimer une méthode de paiement utilisée par une souscription");
      }

      //
      // remove credit balance payment method
      if(this._sources[index].issuer=='invoice'){
        this._metadata['creditbalance'] = null;
        this._metadata['allowCredit'] = null;
        const customer = await $stripe.customers.update(
          this._id,
          {metadata: this._metadata}
        );
        this._sources.splice(index, 1);
        //
        // put this new customer in cache 4h
        cache.set(this.id,this);
        return;
      }

      //
      // remove vash balance payment method
      if(this._sources[index].issuer=='cash'){
        this._metadata['cashbalance'] = null;
        const customer = await $stripe.customers.update(
          this._id,
          {metadata: this._metadata}
        );
    
        this._sources.splice(index, 1);
        //
        // put this new customer in cache 4h
        cache.set(this.id,this);
        return;
      }
  
      //
      // check the stripe used version
      const isNewImp = (card_id[0] === 'p' && card_id[1] === 'm' && card_id[2] === '_');
  
      //
      // FIXME cannot remove payment used by an active subscription

      //
      // dettach
      let confirmation;
      if(isNewImp) {
        confirmation = await $stripe.paymentMethods.detach(card_id);
        this._sources.splice(index, 1);
  
      }else{
        confirmation = await $stripe.customers.deleteSource(this._id,card_id);
        this._sources.splice(index, 1);
      }

      //
      // put this new customer in cache 4h
      cache.set(this.id,this);
    }catch(err) {
      throw (parseError(err));
    }

  }


  // 
  // add credit to a customer
  // FIXME: balance is completly unsecure 
  async updateCredit(amount:number) {
    const _method = 'updatecredit';
    this.lock(_method);
    //
    // max negative credit verification
    if((this.balance + amount)<0) {
      if(!this.allowedCredit()){
        this.unlock(_method);
        throw new Error("Le paiement par crédit n'est pas disponible");
      }

      //
      // check validity
      const fingerprint = crypto_fingerprint(this.id+this.uid+'invoice');
      const check = await this.checkMethods(false);
      if(check[fingerprint].error) {
        this.unlock(_method);
        throw new Error(check[fingerprint].error);
      }

      const maxcredit = Config.option('allowMaxCredit')/100;    
      if((this.balance + amount)<(-maxcredit)) {
        this.unlock(_method);
        throw new Error("Vous avez atteind la limite de crédit de votre compte");
      }
    }

    //
    // max amount credit verification
    const maxamount = Config.option('allowMaxAmount')/100;    
    if((this.balance + amount)>maxamount) {
      this.unlock(_method);
      throw new Error("Vous avez atteind la limite de votre portefeuille "+maxamount.toFixed(2)+" chf");
    }

    //
    // update customer credit 
    const balance = Math.round((amount+this.balance)*100);
    const customer = await $stripe.customers.update(
      this._id,
      {balance}
    );
    this._balance = balance;

    //
    // put this new customer in cache 4h
    cache.set(this.id,this);
    this.unlock(_method);
    return this;
  }


  async updateIdentity(identity) {
    assert(identity);
    assert(this._metadata.uid);
    assert(this._metadata.fname);
    assert(this._metadata.lname);

    try{
      const updated:any= {
        expand: ['cash_balance'],
        metadata:this._metadata
      };
      if(identity.fname){
        updated.metadata.fname = identity.fname;
      }
      if(identity.lname){
        updated.metadata.lname = identity.lname;
      }
      if(identity.email){
        updated.email = identity.email;
      }
      if(identity.phone){
        updated.phone = identity.phone;
      }

      if(this._id.indexOf('cus_1234')==-1){
        const customer = await $stripe.customers.update(
          this._id,updated
        );    
  
        this._metadata = customer.metadata;
        this._email = customer.email;
        this._phone = customer.phone;
        this._fname = customer.metadata.fname;
        this._lname = customer.metadata.lname;  
      }

      //
      // put this new customer in cache 4h
      cache.set(this.id,this);
      return this;
    }catch(err) {
      throw parseError(err);
    }     
  }
  
  //
  // atomic methods
  //

  //
  // verify if customer is allowed for credit
  allowedCredit(){
    //
    // this is the signature of an credit authorization
    const fingerprint = crypto_fingerprint(this.id+this.uid+'invoice');

    return this.methods.some(method => method.alias == fingerprint);
  }

  findMethodByID(id) {
    return this._sources.find(card => card.id == id);
  }  


  findMethodByAlias(alias) {
    return this._sources.find(card => card.alias == alias);
  }  
}

//
// private function to get metadata keys
function metadataElements(metadata,key) {
  return Object.keys(metadata).filter(k => k.indexOf(key)>-1);
}


//
// private function to decode metadata
function parseAddress(metadata) {
  const keys = metadataElements(metadata,'addr');
  const addresses = [];
  keys.forEach(key => {
    try{
      const address = JSON.parse(metadata[key]) as KngPaymentAddress;
      addresses.push(address);  
    }catch(err){
      console.log('---- DBG error parseAddress',err);
    }
  })
  return addresses;
}


function parseError(err) {
  const error = stripeParseError(err);
  Config.option('debug') && console.log('---- DBG error',error);
  return error;
}


function parseMethod(method) {
  assert(method);
  const id = xor(method.id);
  method = method.card||method;
  const alias = xor(method.fingerprint);
  // FIXME method type is always 1
  return {
    type:parseInt(method.type||1),
    id:id,
    alias:alias,
    country:method.country,
    last4:method.last4,
    issuer:method.brand,
    funding: method.funding,
    fingerprint:method.fingerprint,
    expiry:method.exp_month+'/'+method.exp_year,
    updated:Date.now(),
    provider:'stripe'
  };

}
