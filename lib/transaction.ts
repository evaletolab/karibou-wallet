/**
* #transaction.ts
* Copyright (c)2014, by David Pate <pate.david1@gmail.com>
* Licensed under GPL license (see LICENSE)
* TODO? https://groups.google.com/a/lists.stripe.com/forum/#!topic/api-discuss/uoMz4saOa5I
*/

import { strict as assert } from 'assert';
import Stripe from 'stripe';
import Config from './config';
import { Customer } from './customer';
import { KngCard, $stripe, stripeParseError, unxor, xor, KngPayment, KngPaymentInvoice, KngPaymentStatus, KngOrderPayment } from './payments';


export interface PaymentOptions {
  charge?:boolean;
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
  private _payment:Stripe.PaymentIntent|KngPaymentInvoice;
  private _refund:Stripe.Refund;
  private _report:any;


  /**
   * ## transaction()
   * @constructor
   */
  private constructor(payment:Stripe.PaymentIntent|KngPaymentInvoice, refund?:Stripe.Refund) {    
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

  //
  // cash balance create a direct charge (automatic paiement)
  // subscription create a direct charge (automatic paiement)
  // WARNING to keep track of our needs of "manual" the status paid will be => auth_paid
  get status():KngPaymentStatus{
    //
    //
    // PaymentIntentStatus
    // https://stripe.com/docs/payments/intents#intent-statuses
    //   "canceled" "processing" "requires_action" "requires_capture" "requires_confirmation" 
    //   "requires_payment_method"| "succeeded";

    // KngPaymentExendedStatus 
    //  "refund"|"prepaid"|"invoice"|"invoice_paid"|"pending"|"voided";

    // Karibou KngPaymentStatus
    //   "pending","authorized","partially_paid","paid","partially_refunded","refunded"
    //   "invoice","invoice_paid","voided"

    const status = {
      "processing":"pending",
      "requires_action":"requires_action",
      "requires_capture":"authorized",
      "succeeded":"paid",
      "canceled":"canceled",
      "refund":"refund",
      "invoice":"invoice",
      "invoice_paid":"invoice_paid"      
    }
    return (this._payment.metadata.exended_status || this._payment.status) as KngPaymentStatus;
  }

  get client_secret():string{
    return (this._payment.client_secret);
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

  get provider(): string {
    switch(this._payment.payment_method){
      case "invoice":
      return "invoice";
    }
    return "stripe";
  }

  get requiresAction():boolean {
    return this.status == "requires_action" as KngPaymentStatus;
  }
  get authorized():boolean{
    return ["requires_capture","authorized","prepaid","invoice","invoice_paid"].includes(this.status);
  }
  get captured():boolean{
    return ["succeeded","paid","refund"].includes(this.status);
  }
  get canceled():boolean{
    return this.status == "canceled" as KngPaymentStatus;
  }

  get refunded():number{
    const _refunded = parseInt(this._payment.metadata.refund || "0");
    return parseFloat((_refunded/100).toFixed(2));
  }

  get customerCredit() {
    const credit = this._payment.metadata.customer_credit;
    return (credit)? parseFloat(credit)/100:0;
  }

  get report(){
    let amount = this.amount;
    let status = this._payment.status as string;
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
    if(this._refund && this._refund.amount) {
      amount = parseFloat((this._refund.amount/100).toFixed(2));
      status = 'refund';
    }

    const now = new Date();
    return {
      log: status + ' ' + (this.amount) + ' ' + this.currency + ' the '+ now.toDateString(),
      transaction:(this.id),
      updated:now.getTime(),
      provider:'stripe'
    };
  }

  /**
  * ## transaction.get(id)
  * Create a new 2-steps transaction (auth & capture)
  * - https://stripe.com/docs/payments/customer-balance#make-cash-payment
  * @returns the transaction object
  */

  static async authorize(customer:Customer,card:KngCard, amount:number, options:PaymentOptions) {

    assert(options.oid)
    assert(options.shipping)
    assert(options.shipping.streetAdress)
    assert(options.shipping.postalCode)
    assert(options.shipping.name)


    //
    // available credit 
    const usedCredit = Math.min(customer.balance,amount);

    // assert amount_capturable > 100
		const amount_capturable = Math.round((amount-usedCredit)*100);
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


    //
    // IMPORTANT: 
    // https://stripe.com/docs/api/idempotent_requests
    // use idempotencyKey (oid) for safely retrying requests without accidentally 
    // performing the same payment twice.
    // ==> idempotencyKey: options.oid,

    try{
      const params={
        amount:amount_capturable,
        currency: "CHF",
        customer:customer.id,
        transfer_group: tx_group,
        off_session: false,
        capture_method:'manual', // capture amount offline (server side)
        confirm: true,
        shipping: shipping,
        description: tx_description,
        metadata: {
          order: options.oid
        },
      } as Stripe.PaymentIntentCreateParams;

      //
      // use customer credit instead of KngCard
      if(usedCredit == amount){
        await customer.updateCredit(-usedCredit);
        //
        // as credit transaction
        const transaction = createOrderPayment(customer.id,usedCredit*100,0,"authorized",options.oid);
        transaction.amount_received = usedCredit;
        return new Transaction(transaction);
      }
      //
      // use customer negative credit instead of KngCard
      // updateCredit manage the max negative credit
      else if (customer.allowedCredit()) {
        await customer.updateCredit(-amount);
        // as invoice transaction
        const transaction = createOrderPayment(customer.id,amount*100,0,"authorized",options.oid);
        transaction.amount_received = usedCredit;
        return new Transaction(transaction);
      }

      //
      // cash balance create a direct charge
      // manual paiement generate the status auth_paid
      else if (card.type == KngPayment.balance) {
        params.payment_method_types = ['customer_balance'];
        params.payment_method_data= {
          type: 'customer_balance',
        };
        params.currency = customer.cashbalance.currency;
        params.capture_method='automatic';
        // 
        // option charge avoid the 2step payment simulation status  
        params.metadata.exended_status = options.charge ? 'paid':'prepaid';

      }
      else if (card.type == KngPayment.card) {
        params.payment_method = unxor(card.id);
        params.payment_method_types = ['card'];
      } else {
        throw new Error("balance is insufficient to complete the payment");
      }

      const transaction = await $stripe.paymentIntents.create(params);
  
      //
      // update coupled credit with card
      if(usedCredit>0) {
        await customer.updateCredit(-usedCredit);
        transaction.metadata.customer_credit = usedCredit*100+'';
        await $stripe.paymentIntents.update( transaction.id , { 
          metadata:transaction.metadata
        });  

      }

      return new Transaction(transaction);
  
    }catch(err) {
      throw parseError(err);
    }
  }


  /**
  * ## transaction.get(id)
  * Get transaction object from order api
  * @returns {Transaction} 
  */
   static async get(id) {
    const tid = unxor(id);
    const transaction = await $stripe.paymentIntents.retrieve(tid);
    assert(transaction.customer)
    return new Transaction(transaction);
  }

  /**
  * ## transaction.fromOrder(order)
  * Get transaction object from stored karibou order 
  * @returns {Transaction} 
  */
   static async fromOrder(order:KngOrderPayment) {
    switch (order.issuer) {
      case "stripe":
      return await Transaction.get(order.transaction);
      case "invoice":
      //
      // FIXME backport decodeAlias from the old api 
      try{
        const tx=unxor(order.transaction.split('kng_')[1]).split('::');
        const oid = tx[0];
        const amount = parseInt(tx[1]);
        const customer_id = tx[2];
        const transaction:KngPaymentInvoice = createOrderPayment(customer_id,amount,0,order.status,oid);

       return new Transaction(transaction);
  
      }catch(err){
        throw new Error("La référence de la carte n'est pas compatible avec le service de paiement");
      }
    
      
    } 
    throw new Error("Issuer doesnt exist");
  }


  /**
  * ## transaction.confirm(id) 3d secure authorization
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

      const payment = this._payment as Stripe.PaymentIntent;
      const shipping = {
        address: {
          line1:payment.shipping.address.line1,
          postal_code:payment.shipping.address.postal_code,
          country:'CH'
        },
        name: payment.shipping.name
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
        description: payment.description,
        metadata: {
          order: this.oid
        }
      });    
    }

    //
    // normalize amount
		const normAmount = Math.round(amount*100);

    try{
      //
      // case of cash balance
      if(this.status == "prepaid" as KngPaymentStatus) {

        if(normAmount == this._payment.amount) {
          this._payment.metadata.exended_status = null;
          this._payment = await $stripe.paymentIntents.update( this._payment.id , { 
            metadata:this._payment.metadata
          });  

        } 
        //
        // total amount is not the same 
        else {
          await this.refund(amount);  
        }


      } 
      //
      // case of KngCard
      else {
        //
        // if amount is 0 (including shipping), cancel and mark it as paid
        // ONLY available for payment intents
        if(normAmount < 1.0) {
          this._payment = await $stripe.paymentIntents.cancel(this._payment.id);
        } else {
          this._payment = await $stripe.paymentIntents.capture( this._payment.id , { 
            amount_to_capture: normAmount 
          });  
        }

      }


      return this;
    }catch(err) {

      const payment = this._payment as Stripe.PaymentIntent;
			const msg = err.message || err;
			//
			// cancel PaymentIntent can generate an error, avoid it (for now!)
			if(msg.indexOf('Only a PaymentIntent with one of the following statuses may be canceled')>-1){
				const result={
					log:'cancel '+this.oid+' , from '+new Date(payment.created),
					transaction:xor(payment.id),
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

    //
    // prepaid transaction is a simulation for 2 step payment
    // Therefore the case of the partial capture implies a refund
    if (!this.captured && this.status!="prepaid" as KngPaymentStatus){
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
            order:this.oid,
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
      this._payment.metadata.exended_status = "refund";
      this._payment.metadata.refund = (this._refund.amount + this.refunded * 100 )+'';

      this._payment = await $stripe.paymentIntents.update(this._payment.id,{
        metadata:this._payment.metadata
      })
  
      return this;
  
    }catch(err) {
      throw parseError(err);
    }  
  }

}

function createOrderPayment(customer_id,amount,refund,status,oid) {
  //
  // transaction id string format: order_id::amount::customer_id
  const transaction:KngPaymentInvoice = {
    amount:amount,
    client_secret:xor(oid),
    currency:'CHF',
    customer:customer_id,
    description:"#"+oid,
    metadata: {order:oid,refund:refund},
    id:'kng_'+xor(oid+'::'+(amount|0)+'::'+customer_id),
    payment_method:'invoice',
    status:status,
    transfer_group:"#"+oid
 }
 return transaction;
}

function parseError(err) {
  const error = stripeParseError(err);
  Config.option('debug') && console.log('---- DBG error',error);
  return error;
}
