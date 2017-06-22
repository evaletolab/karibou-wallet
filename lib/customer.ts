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

  save() {
    var json:string;

    return JSON.stringify(this);
  }

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

  updatePayment(sourceId:string, sourceData:Source) {
    let index:number=-1;
    for (let i in this.sources) {
      console.log(i);
      if (this.sources[i].sourceId == sourceId) {
        index = Number(i);
        break;
      }
    }
    this.sources[index] = sourceData;
    //return stripe.sources.update(sourceId,metadata).catch(parseError);
  }

  removePayment(sourceId:string) {
    let index:number=-1;
    for (let i in this.sources) {
      console.log(i);
      if (this.sources[i].sourceId == sourceId) {
        index = Number(i);
        break;
      }
    }
    if (index !== -1)
        this.sources.splice(index, 1);
  }

  getPaymentList(paymentList:any[]) {
    var promiseList:any[] = [];
    for (let i in this.sources) {
      promiseList.push(stripe.sources.retrieve(this.sources[i]).then((source) => {
        paymentList.push(source);
      }).catch(parseError));
    }
    return Promise.all(promiseList);
  }

  setStripePayment(sourceId:string) {
    let index:number=-1;
    for (let i in this.sources) {
      console.log(i);
      if (this.sources[i].sourceId == sourceId) {
        index = Number(i);
        break;
      }
    }

    if (index > -1) {
      return stripe.customers.update(this.stripeCusid,{source: sourceId}).catch(parseError);
    } else {
      throw new Error("Source not present in the customer")
    }
  }

  getChargeList() {
    return stripe.charges.list({ customer:this.stripeCusid }).catch(parseError);
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
