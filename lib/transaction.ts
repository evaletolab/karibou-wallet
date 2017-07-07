/**
* #transaction.ts
* Copyright (c)2014, by David Pate <pate.david1@gmail.com>
* Licensed under GPL license (see LICENSE)
* TODO? https://groups.google.com/a/lists.stripe.com/forum/#!topic/api-discuss/uoMz4saOa5I
*/

import { Config } from './config';
import * as stripeLib from 'stripe';
import { Customer } from './customer';
const stripe = stripeLib(Config.option('privatekey'));

export  class  Transaction {
  private cust:Customer;
  private id:string;
  private amount:number;
  private groupId:string;
  private description:string;
  private authorized:boolean;
  private captured:boolean;
  private canceled:boolean;
  private amountRefunded:number; // amount refunded in cents

  /**
   * ## transaction(json)
   * @constructor
   * @param {Customer} cust Customer who is going to be charged
   * @param {number} amount Value in cents to charge
   * @param {string} groupId Unique id for the transaction
   * @param {string} description
   */
  constructor(cust:Customer, amount:number, groupId:string, description:string) {
    this.cust = cust;
    this.groupId = groupId;
    this.amount = amount;
    this.description = description;
    this.authorized = false;
    this.captured = false;
    this.canceled = false;
    this.amountRefunded = 0;
    this.id = undefined;
  }

  /**
  * ## transaction.load()
  * Load a transaction from a serialized object
  * @param {any} params Object which contains same field as transaction
  * @returns {any} Promise which return the transaction object
  */
  static load(params:any) {
    var newTransac = new Transaction(new Customer(JSON.stringify(params.cust)),params.amount,params.groupId,params.description);
    if ("id" in params) {
      return stripe.charges.retrieve(params.id).then((charge) => {
        newTransac.authorized = true;
        newTransac.captured = charge.captured;
        newTransac.canceled = params.canceled;
        newTransac.amountRefunded = charge.amount_refunded;
        newTransac.id = params.id;
        return newTransac;
      }).catch(parseError);
    } else {
      return Promise.resolve().then(() => {
        return newTransac;
      })
    }
  }

  /**
  * ## transaction.save()
  * Save a transaction into a JSON object
  * @returns {any} Serialized transaction object
  */
  save() {
    return JSON.stringify(this);
  }

  /**
  * ## transaction.auth()
  * Authorize the charge on the customer source
  * @returns {any} Promise which return the charge object or a rejected Promise
  */
  auth() {
    if (this.canceled)
      return Promise.reject(new Error("Transaction canceled."));
    if (this.authorized)
      return Promise.reject(new Error("Transaction already authorized."));

    return stripe.charges.create({
      amount: this.amount,
      currency: "chf",
      capture: false,
      customer: this.cust.getId(),
      transfer_group: this.groupId
    }).then((charge) => {
      this.authorized = true;
      this.id = charge.id;
    }).catch(parseError);
  }

  /**
  * ## transaction.capture()
  * Capture the amount on an authorized transaction
  * @returns {any} Promise which return the charge object or a rejected Promise
  */
  capture() {
    if (this.canceled)
      return Promise.reject(new Error("Transaction canceled."));
    if (this.captured)
      return Promise.reject(new Error("Transaction already captured."));
    if (!this.authorized)
      return Promise.reject(new Error("Transaction need to be authorized."));

    return stripe.charges.capture(this.id).then(() => {
      this.captured = true;
    }).catch(parseError);
  }

  /**
  * ## transaction.cancel()
  * Cancel a transaction which has not been captured and prevent any future action
  */
  cancel() {
    if (this.captured)
      new Error("Impossible to cancel captured transaction, try to refund.");
    this.canceled = true;
  }

  /**
  * ## transaction.refund()
  * Refund a part or the totality of the transaction
  * @param {number} amount Value to refund frome the transaction,
  * if not given the totality of the transaction is refuned
  * @returns {any} Promise which return the refund object or a rejected Promise
  */
  refund(amount?:number) {
    if (this.canceled)
      return Promise.reject(new Error("Transaction canceled."));
    if (!this.captured)
      return Promise.reject(new Error("Transaction cannot be refunded before capture, try to cancel."));
    if (this.amountRefunded === this.amount)
      return Promise.reject(new Error("Transaction already fully refunded."));
    if ((amount !== undefined) && (amount > this.amount-this.amountRefunded))
      return Promise.reject(new Error("The refund amount is bigger than the amount left."));

    if (amount === undefined) {
      return stripe.refunds.create({charge: this.id}).then((refund) => {
        this.amountRefunded += refund.amount;
      }).catch(parseError);
    } else {
      return stripe.refunds.create({charge: this.id, amount:amount}).then((refund) => {
        this.amountRefunded += refund.amount;
      }).catch(parseError);
    }
  }

}

function parseError(err) {
  throw new Error(err);
}

export interface Destination {
  account:Account;
  amount:number;
  transferId:string;
}
