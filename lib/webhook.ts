import { strict as assert } from 'assert';
import Stripe from 'stripe';
import { Payment, $stripe, xor, unxor, Address, stripeParseError, Card, CashBalance, crypto_sha256, crypto_randomToken, crypto_fingerprint } from './payments';
import Config from './config';
import { Transaction } from './transaction';
import { SubscriptionContract } from './subscription.contract';

export interface WebhookContent {
  event:string;
  error:boolean;
  subscription?: SubscriptionContract;
  transaction?: Transaction;
}

export default class Webhook {



  /**
  * ## retrieve Webhook.parse(body)
  * Get transaction stripe object from webhook data
  * https://stripe.com/docs/webhooks
  * @returns {Transaction or Subscription } 
  */
   static async parse(body, sig):Promise<WebhookContent> {

    // 
    // body = request.data
    // sig = request.headers['STRIPE_SIGNATURE']
    let event = body;
    try{
      const webhookSecret = Config.option('webhookSecret');
      const event = $stripe.webhooks.constructEvent(body, sig, webhookSecret);
    }catch(err){}
    try {

      //
      // on subscription upcoming 1-3 days before
      if(event.type == 'invoice.upcoming') {
        const invoice = event.data.object as Stripe.Invoice;

        //
        // verify if payment method muste be updated

        const contract = await SubscriptionContract.get(invoice.subscription);
        return { event: event.type,contract,error:false} as WebhookContent;
      }

      // 
      // on invoice payment failed
      if(event.type == 'invoice.payment_failed') {
        const invoice = event.data.object as Stripe.Invoice;
        const transaction = await Transaction.get(invoice.payment_intent);
        const contract = await SubscriptionContract.get(invoice.subscription);
        return { event: event.type ,contract, transaction,error:true} as WebhookContent;
      }


      // 
      // on invoice payment success
      if(event.type == 'invoice.payment_succeeded') {
        const invoice = event.data.object as Stripe.Invoice;
        const contract = await SubscriptionContract.get(invoice.subscription);
        return { event: event.type ,contract,error:false} as WebhookContent;
      }

      //
      // on payment success, 
      if (event.type === 'payment_intent.succeeded') {
        const payment = event.data.object as Stripe.PaymentIntent;
        if(payment.capture_method == 'automatic') {
          payment.metadata.exended_status = 'prepaid';
        }

        const prepaid = await $stripe.paymentIntents.update(payment.id,{
          metadata:payment.metadata
        });        
        const transaction = await Transaction.get(payment.id);

        return { event: event.type ,transaction,error:false} as WebhookContent;
      }
      
      //
      // else ...
      console.log(`Unhandled event type ${event.type}`);

    } catch (err) {
      // On error, log and return the error message
      console.log(`❌ Error message: ${err.message}`);
      throw err;
    }    
  }

      
}
