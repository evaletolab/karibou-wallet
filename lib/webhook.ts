import { strict as assert } from 'assert';
import Stripe from 'stripe';
import { $stripe, xor } from './payments';
import Config from './config';
import { Transaction } from './transaction';
import { SubscriptionContract } from './contract.subscription';

export interface WebhookStripe {
  event:string;
  error:boolean;
  subscription?: SubscriptionContract;
  transaction?: Transaction;
}

export interface WebhookTwilio {
  event:string;
  error:boolean;
}

export class Webhook {



  /**
  * ## retrieve Webhook.stripe(body)
  * Get stripe objects from webhook data
  * https://stripe.com/docs/webhooks
  * @returns {WebhookStripe } 
  */
   static async stripe(body, sig):Promise<WebhookStripe> {

    // 
    // body = request.data
    // sig = request.headers['STRIPE_SIGNATURE']
    let event = body;
    try{
      const webhookSecret = Config.option('webhookSecret');
      event = $stripe.webhooks.constructEvent(body, sig, webhookSecret);
    }catch(err){
      console.log(`⚠️  Webhook signature verification failed.`, err.message);
      throw err;
    }

    try {

      //
      // on subscription upcoming 1-3 days before
      if(event.type == 'invoice.upcoming') {
        const invoice = event.data.object as Stripe.Invoice;

        //
        // verify if payment method muste be updated

        const contract = await SubscriptionContract.get(invoice.subscription);
        
        return { event: event.type,contract,error:false} as WebhookStripe;
      }

      // 
      // on invoice payment failed
      if(event.type == 'invoice.payment_failed') {
        const invoice = event.data.object as Stripe.Invoice;
        const transaction = await Transaction.get(xor(invoice.payment_intent.toString()));
        const contract = await SubscriptionContract.get(invoice.subscription);
        return { event: event.type ,contract, transaction,error:true} as WebhookStripe;
      }


      // 
      // on invoice payment success
      if(event.type == 'invoice.payment_succeeded') {
        const invoice = event.data.object as Stripe.Invoice;
        const transaction = await Transaction.get(xor(invoice.payment_intent.toString()));
        const contract = await SubscriptionContract.get(invoice.subscription);
        return { event: event.type ,contract, transaction ,error:false} as WebhookStripe;
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
        const transaction = await Transaction.get(xor(payment.id));

        return { event: event.type ,transaction,error:false} as WebhookStripe;
      }
      
      //
      // else ...
      console.log(`Unhandled event type ${event.type}`);
      return { event: event.type } as WebhookStripe;
    } catch (err) {
      // On error, log and return the error message
      console.log(`❌ Error message: ${err.message}`);
      throw err;
    }    
  }


  static async twilio(body, sig):Promise<WebhookTwilio>{
    return {} as WebhookTwilio;
  }
      

}
