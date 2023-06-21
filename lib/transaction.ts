/**
* #transaction.ts
* Copyright (c)2020, by olivier@karibou.ch
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
    if(this._payment.id.indexOf('kng_')==0){
      return this._payment.id;
    }
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
    //  "refunded"|"prepaid"|"invoice"|"invoice_paid"|"pending"|"voided";

    // Karibou KngPaymentStatus
    //   "pending","authorized","partially_paid","paid","partially_refunded","refunded"
    //   "invoice","invoice_paid","voided"

    const status = {
      "processing":"pending",
      "succeeded":"paid"
    }
    return (this._payment.metadata.exended_status || status[this._payment.status] ||this._payment.status) as KngPaymentStatus;
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
  // total amount for a stripe transaction should complete with customer credit
  get amount():number{
    if(this.provider=="invoice"){
      return this._payment.amount/100;
    }

    const customer_credit = parseInt(this._payment.metadata.customer_credit||"0");
    const amount = (this.captured||this.canceled)? this._payment.amount_received:this._payment.amount;
    return parseFloat(((customer_credit + amount)/100).toFixed(2));
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
    return (this._payment.payment_method=="invoice")?"invoice":"stripe";
  }

  get requiresAction():boolean {
    return this.status == "requires_action" as KngPaymentStatus;
  }
  get authorized():boolean{
    return ["requires_capture","authorized","prepaid","invoice","invoice_paid"].includes(this.status);
  }
  get captured():boolean{
    return ["succeeded","paid","invoice","invoice_paid","refunded","partially_refunded","manually_refunded"].includes(this.status);
  }
  get canceled():boolean{
    return this.status == "canceled" as KngPaymentStatus;
  }

  get refunded():number{
    const _refunded = parseInt(this._payment.metadata.refund || "0");
    return parseFloat((_refunded/100).toFixed(2));
  }

  //
  // cutomer credit equals the amount for invoice payment
  // for mixed payment, credit is on metadata
  get customerCredit() {
    if(this.provider == "invoice"){
      return this.amount;
    }
    const credit = this._payment.metadata.customer_credit;
    return (credit)? parseFloat(credit)/100:0;
  }

  get report(){
    const now = new Date();
    const amount = ["refunded","partially_refunded","manually_refunded"].includes(this.status)? this.refunded:this.amount;
    return {
      log: this.status + ' ' + (amount) + ' ' + this.currency + ' the '+ now.toDateString(),
      transaction:(this.id),
      status:this.status,
      amount: this.amount,
      refunded: this.refunded,
      customer_credit:this.customerCredit,
      updated:now.getTime(),
      provider:this.provider
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
    // undefined or 0 amount throw an error
    if(!amount || amount < 1.0) {
      throw new Error("Minimum amount is 1.0");
    }

    //
    // available credit 
    const availableCustomerCredit = Math.min(customer.balance,amount);

    // assert amount_capturable > 100
		const amount_capturable = Math.round((amount-availableCustomerCredit)*100);
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
        customer:unxor(customer.id),
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
      if(availableCustomerCredit == amount){
        await customer.updateCredit(-availableCustomerCredit);
        //
        // as credit transaction
        const transaction = createOrderPayment(customer.id,availableCustomerCredit*100,0,"authorized",options.oid);
        transaction.amount_received = availableCustomerCredit;
        return new Transaction(transaction);
      }
      //
      // use customer negative credit instead of KngCard
      // updateCredit manage the max negative credit
      else if (card.issuer == 'invoice') {        
        await customer.updateCredit(-amount);
        // as invoice transaction
        const transaction = createOrderPayment(customer.id,amount*100,0,"authorized",options.oid);
        transaction.amount_received = 0;
        return new Transaction(transaction);
      }

      //
      // CASH BALANCE create a direct charge
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
      // update credit balance when coupled with card
      // should store in stripe tx the amount used from customer balance
      if(availableCustomerCredit>0) {
        await customer.updateCredit(-availableCustomerCredit);
        transaction.metadata.customer_credit = availableCustomerCredit*100+'';
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
   static async fromOrder(payment:KngOrderPayment) {
    try{
      if(!payment.transaction) throw new Error("Man WTF!");
      //
      // FIXME issuer should be an KngPaymentIssuer
      switch (payment.issuer) {
        case "american express":
        case "amex":          
        case "visa":
        case "mc":
        case "mastercard":
        return await Transaction.get(payment.transaction);
        case "cash":
        case "balance":
        case "invoice":
        //
        // FIXME backport decodeAlias from the old api 
          const tx=unxor(payment.transaction.split('kng_')[1]).split('::');
          const oid = tx[0];
          const amount = parseFloat(tx[1]);
          const refund = parseFloat(tx[2]);
          const customer_id = tx[3];
          const transaction:KngPaymentInvoice = createOrderPayment(customer_id,amount,refund,payment.status,oid);

        return new Transaction(transaction);    
      } 
    }catch(err){
      Config.option('debug') && console.log('--- DBG',err.message);
    }

    throw new Error("La référence de paiement n'est pas compatible avec le service de paiement");
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

    if (amount == undefined || amount < 0){
      return Promise.reject(new Error("Transaction need a null or positive amount to proceed"));
    }

    

    // Effectuer un re-capture lorsque la tx en cours a été annulée:
    // - durée de vie de 7 jours maximum,
    // - le montant à disposition est insuffisant
    // off_session = true  payment without user interaction
    // - https://stripe.com/docs/payments/save-during-payment#web-create-payment-intent-off-session
    const _force_recapture= (amount) => {
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
    // normalize amount, minimal capture is 1.0
    // remove already paid amount from customer.balance
    const customer_credit = parseInt(this._payment.metadata.customer_credit||"0") / 100;
		const normAmount = Math.round(Math.max(1,amount-customer_credit)*100);

    try{

      //
      // case of customer credit
      if(this.provider=='invoice') {
        const customer = await Customer.get(this.customer);
        let refundAmount=0;
        let creditAmount=0;
        let status="";
        //
        // case of invoice or invoice_paid
        if(['invoice_paid','invoice'].includes(this.status)){

          //
          // in this case the amount should equal the preivous captured amount
          if(this.amount != normAmount/100) {
            throw new Error("The payment could not be finalyzed because the paid amount is not equal to the value captured");
          }

          creditAmount = this.amount;
          status = "paid";
        }
        //
        // case of authorized paiement
        else{
          //
          // capture can't exceed the initial locked amount 
          if(this.amount<(normAmount/100)) {
            throw new Error("The payment could not be captured because the requested capture amount is greater than the amount you can capture for this charge");
          }

          //
          // compute the amount that should be restored on customer account
          // FIXME missing test with error when auth 46.3, capture 40 and refund 6.3
          refundAmount = creditAmount = Math.round(this.amount*100-normAmount)/100;          
          status = (customer.balance<0)? "invoice":"paid";
        }


        await customer.updateCredit(creditAmount);

        //
        // depending the balance position on credit or debit, invoice will be sent
        this._payment = createOrderPayment(this.customer,normAmount,(this.refunded+refundAmount)*100,status,this.oid);
        this._payment.amount_received = normAmount;
        return this;
      }

      //
      // CASH BALANCE
      if(this.status == "prepaid" as KngPaymentStatus) {

        if(normAmount == this._payment.amount) {
          this._payment.metadata.exended_status = null;
          this._payment = await $stripe.paymentIntents.update( this._payment.id , { 
            metadata:this._payment.metadata
          });  

        } 
        //
        // for cashbalance total amount is not the same 
        // normAmount remove the amount paid from customer credit
      else {
          await this.refund(normAmount/100);  
        }


      } 
      //
      // case of KngCard
      // normAmount remove the amount paid from customer credit
      else {
        //
        // if amount is 0 (including shipping), cancel and mark it as paid
        // ONLY available for payment intents
        if(amount === 0) {
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

			this._payment = await _force_recapture(amount);
      return this;
    }

  }

  /**
  * ## transaction.cancel()
  * Cancel a transaction which has not been captured and prevent any future action
  */
  async cancel() {
    if (this.captured){
      throw new Error("Impossible to cancel captured transaction, try to refund.");
    }

    try{
      // keep stripe id in scope
      const stripe_id = this._payment.id;

      // credit amount already paid with this transaction      
      const customer_credit = parseInt(this._payment.metadata.customer_credit||"0") / 100;
      if(customer_credit>0){
        const customer = await Customer.get(this.customer);
        await customer.updateCredit(customer_credit);                
        this._payment = createOrderPayment(this.customer,this.amount*100,this.refunded*100,"canceled",this.oid);
      }
      if(this.provider == "stripe"){
        this._payment = await $stripe.paymentIntents.cancel(stripe_id);
      }
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

    //
    // undefined amount implies maximum refund
    if(amount!=undefined && amount == 0) {
      throw new Error('Aucun montant a rembourser');
    }


    //
    // check maximum available amount
    if(amount!=undefined &&  this.amount<amount) {
      throw new Error("The refund has exceeded the amount available for this transaction");
    }
 
 
    if (this.canceled){
      throw new Error("Transaction canceled.");
    }

    //
    // prepaid transaction is a simulation for 2 step payment
    // Therefore the case of the partial capture implies a refund
    if (!this.captured && this.status!="prepaid" as KngPaymentStatus){
      throw new Error("Transaction cannot be refunded before capture, try to cancel.");
    }


    // keep stripe id in scope
    const stripe_id = this._payment.id;
    try{


      //
      // credit amount already paid with this transaction
      const customer_credit = parseInt(this._payment.metadata.customer_credit||"0") / 100;
      const customer = await Customer.get(this.customer);


      //
      // case of invoice mean all the transaction is based on customer credit
      // undefined amount implies total available amount
      if(this.provider=='invoice'){
        const creditAmount = amount||this.amount;

        await customer.updateCredit(creditAmount);  
        this._payment = createOrderPayment(this.customer,(this.amount-creditAmount)*100,(this.refunded+creditAmount)*100,"refunded",this.oid);
        return this;
      }

      //
      // amount captured by stripe
      const amount_received = this._payment.amount_received/100;
      let credit_refunded;
      
      //
      // case of positive amount for Stripe or mixed payment
      if (amount > 0) {

        //
        // stripe amount is the maximal refund for stripe
        const stripeAmount = (amount>amount_received)? Math.round(Math.max(0,amount-amount_received)):amount;
        const creditAmount = Math.round(Math.max(0,amount-stripeAmount));

        //
        // refund customer credit amount 
        if(creditAmount>0) {
          await customer.updateCredit(creditAmount);  
          credit_refunded = createOrderPayment(this.customer,0,(this.refunded+creditAmount)*100,"refunded",this.oid);
        }
        //
        // refund stripe amount 
        if(stripeAmount>0){
          this._refund = await $stripe.refunds.create({
            payment_intent: stripe_id, 
            amount:stripeAmount*100,
            metadata:{
              order:this.oid,
              refunded:creditAmount*100
            }
          });  
        }
      } else {
        if(customer_credit) {
          await customer.updateCredit(customer_credit);  
          credit_refunded = createOrderPayment(this.customer,0,(this.refunded+customer_credit)*100,"refunded",this.oid);  
        }

        this._refund = await $stripe.refunds.create({
          payment_intent: stripe_id,
          metadata:{
            order:this.oid,
            refunded:customer_credit*100
          }
        });        
      }
  
      //
      // update the total refund on orginal transaction
      const creditAmount = credit_refunded? credit_refunded.amount_refunded:0;
      this._payment.metadata.exended_status = "refunded";
      this._payment.metadata.refund = (creditAmount + this._refund.amount + this.refunded * 100 )+'';

      this._payment = await $stripe.paymentIntents.update(stripe_id,{
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
    amount_refunded:refund||0,
    currency:'CHF',
    customer:customer_id,
    description:"#"+oid,
    metadata: {order:oid,refund:refund},
    id:'kng_'+xor(oid+'::'+(amount)+'::'+(refund||0)+'::'+customer_id),
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
