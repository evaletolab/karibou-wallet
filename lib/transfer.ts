/**
* #transfer.ts
* Copyright (c)2014, by David Pate <pate.david1@gmail.com>
* Licensed under GPL license (see LICENSE)
*/

import { Config } from './config';
import { Transaction } from './transaction';
import { Account } from './account';
import * as stripeLib from 'stripe';
const stripe = stripeLib(Config.option('privatekey'));

export interface Destination {
  account:Account;
  amount:number;
  transferId:string;
  amountRefunded:number;
  logs:string[];
}

export class Transfer {
  private transaction:Transaction;
  private dest:Destination[];

  /**
   * ## transfer(json)
   * @constructor
   * @param {Transaction} transaction Transaction object
   * @param {Destination} dest Array of Destination
   *  Each different account must appear only one time in the array
   */
  private constructor(transaction:Transaction, dest:Destination[]) {
    this.transaction = transaction;
    this.dest = dest;
    for (let i in dest) {
      this.dest[i].transferId = undefined;
      this.dest[i].amountRefunded = 0;
      this.dest[i].logs = [];
    }
  }

  /**
  * ## transfer.load()
  * Load a transfer from a serialized object
  * @param {any} params Object which contains same field as transfer
  * @returns {any} Promise which return the transfer object
  */
  static load(params:any) {
    var newTransfer = new Transfer(params.transaction, params.dest);
    newTransfer.dest = params.dest;
    return newTransfer;
  }

  /**
  * ## transfer.save()
  * Save a transfer into a JSON object
  * @returns {any} Serialized transfer object
  */
  save() {
    return JSON.stringify(this);
  }

  /**
  * ## transfer.execute()
  * Execute all the transfers that haven't already been done
  * @returns {any} Promise or rejected Promise
  */
  execute() {
    var promiseList = [];
    if (!this.transaction.isCaptured)
      return Promise.reject(new Error("Transaction must be captured before any transfer."));
    if (this.transaction.getAmountRefunded() !== 0)
      return Promise.reject(new Error("Transaction must not have been refunded before transfers"));

    return stripe.transfers.list({transfer_group:this.transaction.getGroupId(), limit:100})
    .then((transferList) => {

      for (let i in this.dest) {
        if (this.dest[i].transferId === undefined) {
          var ok = true;
          // Check if the transfer has never been done
          for (let j in transferList.data) {
            if (transferList.data[j].destination === this.dest[i].account.getId()) {
              ok = false;
              break;
            }
          }
          if (ok) {
            promiseList.push(stripe.transfers.create({
              amount: this.dest[i].amount,
              currency: "chf",
              destination: this.dest[i].account.getId(),
              transfer_group: this.transaction.getGroupId(),
              source_transaction: this.transaction.getId()
            }).then((transferStripe) => {
              this.dest[i].transferId = transferStripe.id;
              this.dest[i].logs.push("Executed");
            }));
          }
        }
      }

      return Promise.all(promiseList).catch(parseError);
    })
  }

  /**
  * ## transfer.refund()
  * Refund partially or totally a transfer
  * @param {Account} account Account from which the refund will be
  * @param {string} description
  * @param {amount} number The value to refund, if not given the max value is used
  * @returns {any} Promise of the refund or rejected Promise
  */
  refund(account:Account, description:string, amount?:number) {
    var index = undefined;
    for (let i in this.dest) {
      if (this.dest[i].account.getId() === account.getId()) {
        index = i;
        break;
      }
    }

    if (index === undefined)
      return Promise.reject(new Error("Account for the transfer not found."));
    if (this.dest[index].transferId === undefined)
      return Promise.reject(new Error("Transfer not done."));

    if (amount === undefined)
      amount = this.dest[index].amount-this.dest[index].amountRefunded;
    if (this.dest[index].amount-this.dest[index].amountRefunded < amount)
      return Promise.reject(new Error("Refund impossible the amount is bigger than the one left."));

    return stripe.transfers.createReversal(this.dest[index].transferId,{amount:amount})
        .then((refund) => {
          this.dest[index].amountRefunded += refund.amount;
          this.dest[index].logs.push("Refund: "+description);
        }
    ).catch(parseError);
  }

  /**
  * ## transfer.refundAll()
  * Refund totally all the transfers
  * @returns {any} Promise
  */
  refundAll(description:string) {
    var promiseList = [];
    for (let i in this.dest) {
      if ((this.dest[i].transferId !== undefined) && (this.dest[i].amount > this.dest[i].amountRefunded))
      promiseList.push(stripe.transfers.createReversal(this.dest[i].transferId)
        .then(() => {
          this.dest[i].amountRefunded = this.dest[i].amount;
          this.dest[i].logs.push("Refund: "+description);
        })
      );
    }
    return Promise.all(promiseList).catch(parseError);
  }

  /**
  * ## transfer.getState()
  * Get the state of a transfer linked to an account
  * @param {Account} account
  * @returns {Destination} Information on the transfer
  */
  getState(account:Account) {
    for (let i in this.dest) {
      if (account.getId() === this.dest[i].account.getId())
        return this.dest[i];
    }
  }

}

function parseError(err) {
  throw new Error(err);
}
