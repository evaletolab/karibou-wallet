/**
* #customer.ts
* Copyright (c)2014, by David Pate <pate.david1@gmail.com>
* Licensed under GPL license (see LICENSE)
*/

import { strict as assert } from 'assert';
import Stripe from 'stripe';
import { Payment, $stripe, xor, unxor, Address, stripeParseError } from './payments';
import Config from './config';


export interface Source {
  type:Payment;
  id:string;
}

export interface Card extends Source {
  alias:string;
  country:string;
  last4:string;
  issuer:string;
  funding:string;
  fingerprint:string;
  expiry:string;
  brand:string;
}



export class Customer {

  private _available: boolean;
  private _sources:Stripe.Card[]|any;
  private _id:string;
  private _metadata:any;

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
  private _addresses:Address[];

  /**
   * ## customer(id,email,displayName,uid)
   * @param  customer created by Stripe
   * @constructor
   */
  private constructor(id:string,email:string, phone: string, metadata:any) {
    assert(id);
    assert(email);
    assert(phone);
    assert(metadata.uid);
    assert(metadata.fname);
    assert(metadata.lname);
    
    this._email = email;
    this._phone = phone;
    this._fname = metadata.fname;
    this._lname = metadata.lname;
    this._uid = metadata.uid;
    this._id = id;
    this._metadata = metadata;

    //
    // when loading existant customer
    this._sources = [];
    this._addresses = parseAddress(metadata);
  }

  //
  // Stripe id must be stable over time, this why we dont use xor(_id)
  get id() {
    return (this._id);
  }
  
  get email() {
    return this._email;
  }

  
  get phone() {
    return this._phone;
  }

  get name() {
    return {
      familyName:this._fname,
      givenName:this._lname
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


  /**
  * ## customer.create()
  * Async constructor of customer
  * @returns a new Customer 
  */
  static async create(email:string, fname:string, lname:string, phone: string, uid:string) {
    try{
      const customer = await $stripe.customers.create({
        description: fname + ' ' + lname + ' id:'+uid,
        email: email,
        phone,
        metadata: {uid,fname, lname}
      });  

      return new Customer(customer.id,email,phone,customer.metadata); 
    }catch(err) {
      throw parseError(err);
    } 


    // try{

    // }catch(err) {
    //   throw parseError(err);
    // } 
  }
    


  /**
  * ## customer.get()
  * @returns a Customer instance with all private data in memory
  */
  static async get(id) {
    try{
      const stripe = await $stripe.customers.retrieve(id) as any;
      const customer = new Customer(
        stripe.id,
        stripe.email,
        stripe.phone,
        stripe.metadata
      ); 
      await customer.listMethods();
      return customer;
    }catch(err) {
      throw parseError(err);
    } 
  }



  async addressAdd(address: Address) {
    assert(this._metadata.uid);
    assert(this._metadata.fname);
    assert(this._metadata.lname);

    try{
      const keys = metadataElements(this._metadata,'addr');
      address.id = 'addr-' + keys.length + 1;
      this._metadata[address.id] = JSON.stringify(address,null,0);
      const customer = await $stripe.customers.update(
        this._id,
        {metadata: this._metadata}
      );
      
      this._metadata = customer.metadata;
      this._addresses = parseAddress(customer.metadata);  
    }catch(err) {
      throw parseError(err);
    }     
  }

  async addressRemove(address: Address) {
    assert(this._metadata.uid);
    assert(this._metadata.fname);
    assert(this._metadata.lname);
    assert(this._metadata[address.id]);

    try{
      this._metadata[address.id] = null;
      const customer = await $stripe.customers.update(
        this._id,
        {metadata: this._metadata}
      );
      
      this._metadata = customer.metadata;
      this._addresses = parseAddress(customer.metadata);  
    }catch(err) {
      throw parseError(err);
    }     
  }

  async addressUpdate(address: Address) {
    assert(this._metadata.uid);
    assert(this._metadata.fname);
    assert(this._metadata.lname);
    assert(this._metadata[address.id]);

    try{
      this._metadata[address.id] = JSON.stringify(address,null,0);
      const customer = await $stripe.customers.update(
        this._id,
        {metadata: this._metadata}
      );
      
      this._metadata = customer.metadata;
      this._addresses = parseAddress(customer.metadata);  
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
  * @returns the payment method object
  */
  async addMethod(token:string) {
    try{
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
      const exist = this._sources.find(method => card.alias == method.alias )
      if(exist) {
        //
        // FIXME cannot remove payment used by an active subscription
        await $stripe.paymentMethods.detach(unxor(exist.id));        
      }
      this._sources.push(card);
      return card;
    }catch(err) {
      throw parseError(err);
    } 
  }


  /**
  * ## customer.removeMethod()
  * Remove a payment's method of the customer
  * @param {string} paymentId Stripe id of the source
  * @returns {any} Promise on deletion of the source
  */
  async removeMethod(method:Card) {
    try{
      const index:number= this._sources.findIndex(src => src.id == method.id);

      if (index == -1) {
        throw new Error("Source ID not found");
      }
  
      const card_id = unxor(method.id);

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
      console.log(" --- DBG removeMethod ",confirmation);
  
    }catch(err) {
      throw (parseError(err));
    }

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
      return this._sources.slice();
    }catch(err){
      throw parseError(err);
    }
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
      const address = JSON.parse(metadata[key]) as Address;
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

  return {
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
