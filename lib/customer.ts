/**
* #customer.ts
* Copyright (c)2014, by David Pate <pate.david1@gmail.com>
* Licensed under GPL license (see LICENSE)
*/

import { Config } from './config';
import * as stripeLib from 'stripe';
import { Payment } from './payments.enum';
const stripe = stripeLib(Config.option('privatekey'));

export  class  Customer {
  private stripeCusid:string;
  private sources:Source[];
  private map:{};
  private email:string;
  private lastname:string;
  private firstname:string;

  /**
   * ## customer(json)
   * @param {string} json Json serialized customer object
   * @constructor
   */
  constructor(json:string) {
    let tmp = JSON.parse(json);
    if ("email" in tmp) this.email = tmp.email;
    else throw new Error("Missing parameter: email");

    if ("lastname" in tmp) this.lastname = tmp.lastname;
    else throw new Error("Missing parameter: lastname");

    if ("firstname" in tmp) this.firstname = tmp.firstname;
    else throw new Error("Missing parameter: firstname");

    this.stripeCusid = null;
    this.sources = [];
    if ("stripeCusid" in tmp) this.stripeCusid = tmp.stripeCusid;
    if ("sources" in tmp) this.sources = tmp.sources;

    this.map={};
    this.map[Payment.card]='card';
    this.map[Payment.sepa]='sepa_debit';
    this.map[Payment.bitcoin]='bitcoin';
  }

  /**
  * ## customer.create()
  * Async constructor of customer
  * @param {string} email
  * @param {string} lastname
  * @param {string} firstname
  * @returns {Boolean} Check result
  */
  static create(email:string, lastname:string, firstname:string) {
    return stripe.customers.create({
      description: lastname+' '+firstname,
      email: email
    }).then((customerStripe) => {
      var custJson = JSON.stringify({
        email:email,
        lastname:lastname,
        firstname:firstname,
        stripeCusid:customerStripe.id
      });
      return new Customer(custJson);
    }).catch(parseError);
  }

  /**
  * ## customer.save()
  * Serialize the object into JSON
  * @returns {string} Customer object in JSON
  */
  save() {
    var json:string;

    return JSON.stringify(this);
  }

  /**
  * ## customer.addPayment()
  * Add method of payment for the customer
  * @param {Source} sourceData Source object containing all the informatio
  * needed for payment creation
  * @param {string} token Some source require token to be created
  * @returns {any} Promise for the source creation
  */
  addPayment(sourceData:Source, token?:string) {
    if (!(sourceData.type in this.map))
      throw new Error("Unknown payment type");

    var newSourceData = {...sourceData}; // copy sourceData
    if (newSourceData.type == Payment.card) {
      return stripe.customers.createSource(this.stripeCusid,{ source: token }).then((card) => {
        var newCard:Card = {
          type:Payment.card,
          sourceId:card.id,
          owner:newSourceData.owner,
          brand:card.brand,
          exp_year:card.exp_year,
          exp_month:card.exp_month,
          last4:card.last4
        }
        this.sources.push(newCard);
      }).catch(parseError);
    } else {
      throw new Error("Unknown payment type");
    }
  }

  /**
  * ## customer.updatePayment()
  * Update a payment's method of the customer
  * @param {string} sourceId Stripe id of the source
  * @param {Source} sourceData New data for the source
  */
  updatePayment(sourceId:string, sourceData:Source) {
    var index = this.sources.findIndex(elem => elem.sourceId===sourceId)
    this.sources[index] = sourceData;
  }

  /**
  * ## customer.removePayment()
  * Remove a payment's method of the customer
  * @param {string} sourceId Stripe id of the source
  * @returns {any} Promise on deletion of the source
  */
  removePayment(sourceId:string) {
    var index:number=-1;
    for (let i in this.sources) {
      if (this.sources[i].sourceId == sourceId) {
        index = Number(i);
        break;
      }
    }

    if (index !== -1) {
      return stripe.customers.deleteCard(this.stripeCusid,this.sources[index].sourceId).then(() => {
        this.sources.splice(index, 1);
      }).catch(parseError);
    } else {
      throw new Error("Source ID not found");
    }
  }

  /**
  * ## customer.getPaymentList()
  * List of all the payment's method of the customer
  * @returns {any[]} Promise which return the list of payment available
  */
  getPaymentList() {
    var paymentList:any[] = [];
    var promiseList:any[] = [];
    for (let i in this.sources) {
      switch(this.sources[i].type) {
        case Payment.card:
          promiseList.push(stripe.customers.retrieveCard(this.stripeCusid,this.sources[i].sourceId).then((source) => {
            paymentList.push(source);
          }).catch(parseError));
          break;
        default:
          throw new Error("Unknown payment type");
      }
    }
    return Promise.all(promiseList).then(function () {return paymentList});
  }

  /**
  * ## customer.setStripePayment()
  * Set the payment's method which is going to be used for the next charge
  * @param {string} sourceId Stripe id of the source
  * @returns {any} Promise
  */
  setStripePayment(sourceId:string) {
    var index:number=-1;
    for (let i in this.sources) {
      if (this.sources[i].sourceId == sourceId) {
        index = Number(i);
        break;
      }
    }

    if (index > -1) {
      return stripe.customers.update(this.stripeCusid,{default_source: sourceId}).catch(parseError);
    } else {
      throw new Error("Source not present in the customer")
    }
  }

  /**
  * ## customer.getChargeList()
  * Return the charge's list of the customer, if chargeOffset is set, the list
  * begin after it.
  * @param {number} limit Number of charges to display (1-100) default = 10
  * @param {any} chargeOffset Last object of the previous charge's list
  * @returns {any} Promise which return the list of charges
  */
  getChargeList(limit:number=10, chargeOffset?:any) {
    if (chargeOffset != undefined)
      return stripe.charges.list({ customer:this.stripeCusid, limit:limit, starting_after:chargeOffset }).catch(parseError);
    else
      return stripe.charges.list({ customer:this.stripeCusid, limit:limit }).catch(parseError);
  }
}

function parseError(err) {
  throw new Error(err);
}

export interface Source {
  type:Payment;
  sourceId:string;
  owner:string;
}

export interface Card extends Source {
  last4:string;
  exp_month:number;
  exp_year:number;
  brand:string;
}
