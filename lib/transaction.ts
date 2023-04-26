/**
* #transaction.ts
* Copyright (c)2014, by David Pate <pate.david1@gmail.com>
* Licensed under GPL license (see LICENSE)
* TODO? https://groups.google.com/a/lists.stripe.com/forum/#!topic/api-discuss/uoMz4saOa5I
*/

import { strict as assert } from 'assert';
import Stripe from 'stripe';
import { Card, Customer } from './customer';
import { $stripe, unxor, xor } from './payments';

export interface PaymentOptions {
  oid:string;
  txgroup:string;
  email:string;
  shipping: {
    streetAdress:string;
    postalCode:string;
    name: string;  
  }
}

export  class  Transaction {
  private _payment:Stripe.PaymentIntent;
  private _refund:Stripe.Refund;
  private _report:any;

  /**
   * ## transaction()
   * @constructor
   */
  private constructor(payment:Stripe.PaymentIntent, refund?:Stripe.Refund) {    
    this._payment = payment;
    this._refund = refund || {} as Stripe.Refund;
    this._report = {};
  }

  get id():string{
    return xor(this._payment.id);
  }

  get oid():string{
    return (this._payment.metadata.order);
  }

  get paymentId():string{
    return xor(this._payment.payment_method as string);
  }

  get customer():string{
    return (this._payment.customer as string);
  }


  //
  // return the total amount authorized or the captured amount
  get amount():number{
    const _amount = this.captured? this._payment.amount_received:this._payment.amount;
    return parseFloat((_amount/100).toFixed(2));
  }
  get group():string{
    return this._payment.transfer_group;
  }

  get currency():string{
    return this._payment.currency;
  }

  get description():string{
    return this._payment.description;
  }

  get requiresAction():boolean {
    return this._payment.status == "requires_action";
  }
  get authorized():boolean{
    return this._payment.status == "requires_capture";
  }
  get captured():boolean{
    return this._payment.status == "succeeded";
  }
  get canceled():boolean{
    return this._payment.status == "canceled";
  }

  get refunded():number{
    const _refunded = parseInt(this._payment.metadata.refund || "0");
    return parseFloat((_refunded/100).toFixed(2));
  }

  get report(){
    let now = new Date(this._payment.created * 1000);
    let amount = this.amount;
    let status;
    switch(this._payment.status){
      case 'requires_action':
        status = 'requires_action'
        break;
      case 'canceled':
        status = 'cancel'
        break;
      case 'requires_capture':
        status = 'authorized'
        break;
      case 'succeeded':
        status = 'captured'
        break;
    }
    if(this._refund.amount) {
      amount = parseFloat((this._refund.amount/100).toFixed(2));
      status = 'refund';
      now = new Date();
    }


    return {
      log: status + ' ' + (this.amount) + ' ' + this.currency + ' the '+ now.toDateString(),
      transaction:(this.id),
      updated:Date.now(),
      provider:'stripe'
    };
  }

  /**
  * ## transaction.get(id)
  * Load a transaction from a Stripe
  * @returns the transaction object
  */

  static async authorize(customer:Customer,card:Card, amount:number, options:PaymentOptions) {

		const amount_capturable = Math.round(amount*100);
		const tx_description = "#"+options.oid+" for "+options.email;
    const tx_group = options.txgroup;
		const shipping = {
			address: {
				line1:options.shipping.streetAdress,
				postal_code:options.shipping.postalCode,
				country:'CH'
			},
			name: options.shipping.name
		};

		const transaction = await $stripe.paymentIntents.create({
			amount:amount_capturable,
		  currency: "CHF",
		  customer:customer.id,
			payment_method: unxor(card.id), 
			transfer_group: tx_group,
			off_session: false,
			capture_method:'manual', // capture amount offline (server side)
	    confirm: true,
			shipping: shipping,
			description: tx_description,
			metadata: {
				order: options.oid
			},
    });

    return new Transaction(transaction);
  }


  /**
  * ## transaction.get(id)
  * Get transaction stripe object from order api
  * @returns {Transaction} 
  */
   static async get(id) {
    const tid = unxor(id);
    const transaction = await $stripe.paymentIntents.retrieve(tid);
    assert(transaction.customer)
    return new Transaction(transaction);
  }

  /**
  * ## transaction.capture()
  * Capture the amount on an authorized transaction
  * @returns {any} Promise which return the charge object or a rejected Promise
  */
   static async confirm(id:string) {
    const tid = unxor(id);
    const transaction = await $stripe.paymentIntents.update(tid);
    assert(transaction.customer)
    return new Transaction(transaction);
   }

  /**
  * ## transaction.capture()
  * Capture the amount on an authorized transaction
  * @returns {any} Promise which return the charge object or a rejected Promise
  */
  async capture(amount:number) {
    if (this.canceled){
      return Promise.reject(new Error("Transaction canceled."));
    }
    if (this.captured){
      return Promise.reject(new Error("Transaction already captured."));
    }
    if (!this.authorized){
      return Promise.reject(new Error("Transaction need to be authorized."));
    }

    if (amount == undefined){
      return Promise.reject(new Error("Transaction need to an minimal amount to proceed"));
    }

    // Effectuer un recapture lorsque la tx en cours a été annulée:
    // - durée de vie de 7 jours maximum,
    // - le montant à disposition est insuffisant
    // off_session = true  payment without user interaction
    // - https://stripe.com/docs/payments/save-during-payment#web-create-payment-intent-off-session
    const _recapture= (amount) => {
      const paymentId = unxor(this.paymentId);
      console.log(' -- WARNING: charge has expired, create a new one with the ref ' + (this.customer) + '/' + (this.paymentId));

      // Pour donner un exemple, si un client a effectué plus de 5 paiements, 
      // ou une série de paiements d'une somme supérieure à 100€ 
      // sans authentification, la banque serait alors forcée de demander 
      // l'authentification sur le prochain paiement, même s'il est hors-session.

      const shipping = {
        address: {
          line1:this._payment.shipping.address.line1,
          postal_code:this._payment.shipping.address.postal_code,
          country:'CH'
        },
        name: this._payment.shipping.name
      };
  

      // FIXME, CHF currency are not accepted for US cards.!! 
      return $stripe.paymentIntents.create({
        amount:amount,
        currency: "CHF",
        customer:(this.customer),
        payment_method: paymentId, 
        transfer_group: this.group,
        off_session: true,
        capture_method:'automatic', 
        confirm:true,
        shipping: shipping,
        description: this._payment.description,
        metadata: {
          order: this.oid
        }
      });    
    }

    //
    // normalize amount
		amount = Math.round(amount*100);

    try{
      //
      // if amount is 0 (including shipping), cancel and mark it as paid
      // ONLY available for payment intents
      if(amount < 1.0) {
        this._payment = await $stripe.paymentIntents.cancel(this._payment.id);
      } else {
        this._payment = await $stripe.paymentIntents.capture( this._payment.id , { 
          amount_to_capture: amount 
        });  
      }
      return this;
    }catch(err) {

			const msg = err.message || err;
			//
			// cancel PaymentIntent can generate an error, avoid it (for now!)
			if(msg.indexOf('Only a PaymentIntent with one of the following statuses may be canceled')>-1){
				const result={
					log:'cancel '+this.oid+' , from '+new Date(this._payment.created),
					transaction:xor(this._payment.id),
					updated:Date.now(),
					provider:'stripe'
				};
				return result;
			}

      //
      // FORCE RECAPTURE when paymentIntent has expired
			// FIXME replace recapture when 'the charge has expired' but with payment_intents
			// case of recapture
			// 1. https://stripe.com/docs/api/payment_intents/cancel cancellation_reason == abandoned
			// 2. https://stripe.com/docs/error-codes#payment-intent-payment-attempt-expired
			// 3. https://stripe.com/docs/error-codes#charge-expired-for-capture
			if(msg.indexOf('PaymentIntent could not be captured because it has a status of canceled') == -1 &&
				msg.indexOf(' the charge has expired') == -1 ){
				throw new Error(err);
			}

			this._payment = await _recapture(amount);
      return this;
    }

  }

  /**
  * ## transaction.cancel()
  * Cancel a transaction which has not been captured and prevent any future action
  */
  async cancel() {
    if (this.captured){
      new Error("Impossible to cancel captured transaction, try to refund.");
    }

    try{
      this._payment = await $stripe.paymentIntents.cancel(this.id);
      return this;  
    }catch(err) {
      throw parseError(err);
    }
  }

  /**
  * ## transaction.refund(amount?)
  * Refund a part or the totality of the transaction
  * @param {number} amount Value to refund frome the transaction,
  * if not given the totality of the transaction is refuned
  * @returns return the refund object report
  */
  async refund(amount?:number) {
    amount = Math.round(amount*100);
    if (this.canceled){
      return Promise.reject(new Error("Transaction canceled."));
    }

    if (!this.captured){
      return Promise.reject(new Error("Transaction cannot be refunded before capture, try to cancel."));
    }

    if(amount!=undefined && amount == 0) {
      throw new Error('Aucun montant a rembourser');
    }

    try{
      if (amount > 0) {
        this._refund = await $stripe.refunds.create({
          payment_intent: this._payment.id, 
          amount:amount,
          metadata:{
            order:this.oid
          }
        });
      } else {
        this._refund = await $stripe.refunds.create({
          payment_intent: this._payment.id,
          metadata:{
            order:this.oid
          }
        });        
      }
  
      //
      // update the total refund on orginal transaction
      this._payment = await $stripe.paymentIntents.update(this._payment.id,{
        metadata:{refund: (this._refund.amount + this.refunded * 100 )}
      })
  
      return this;
  
    }catch(err) {
      throw parseError(err);
    }  
  }

}

function parseError(err) {
  throw new Error(err);
}
