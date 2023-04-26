import { strict as assert } from 'assert';
import Stripe from 'stripe';
import { Card, Customer } from './customer';
import { $stripe, Address, unxor } from './payments';
import Config from './config';

export type Interval = Stripe.Plan.Interval;


export interface SubscriptionMetaItem {
  sku: string|number;
  quantity:number;
  title : string;
  part : string;
  hub : string;
  note : string;
  fees : number;
}

export interface SubscriptionItem {
  currency:string;
  unit_amount:number;
  product:string;
  recurring:{
    interval:Interval;
    interval_count: number;
  }
  metadata?:SubscriptionMetaItem;
}

export enum SchedulerStatus {
  active = 1, paused, pending, closed
}


export enum SchedulerItemFrequency {
  RECURRENT_NONE      = 0,
  RECURRENT_DAY       = 1,
  RECURRENT_WEEK      = 2,
  RECURRENT_2WEEKS    = 3,
  RECURRENT_MONTH     = 4
}

export interface SubscriptionAddress extends Address {
  price: number;
  dayOfWeek?: number;
}
  

/** 
  contractId
  - 8 days start from X
  - 12 weeks start from Y
  - 16 month start from Z
  status: active, pending, closed, paused */
export class SubscriptionContract {

  private _subscription: Stripe.Subscription; 
  private _status:SchedulerStatus;
  private _id:string;
  private _interval:Interval;
  private _interval_count:number;

  private constructor(subs:Stripe.Subscription) {
    this._subscription = subs;
    this._interval = this._subscription.items.data[0].plan.interval;
    this._interval_count = this._subscription.items.data[0].plan.interval_count;
  }

  get id () { return this._subscription.id }
  get interval () { 
    return {
      start:this.billing_cycle_anchor,
      bill: this._interval, 
      count:this._interval_count
    } 
  }
  
  //
  // https://stripe.com/docs/api/subscriptions/object#subscription_object-status
  get status () { 
    if(this._subscription.pause_collection) {
      return 'paused';
    }

    return this._subscription.status 
  }
  get description () { return (this._subscription as any).description }

  get pausedUntil() {
    if(this._subscription.pause_collection && this._subscription.pause_collection.resumes_at) {
      return (this._subscription.pause_collection.resumes_at) || 0;
    }
    return 0
  }
  //
  // return the delivery shippping and date for which the subscription is scheduled
  get shipping ():SubscriptionAddress {
    return parseShipping(this._subscription.metadata);
  }

  //
  // configure the billing cycle anchor to fixed dates (for example, the 1st of the next month).
  // For example, a customer with a monthly subscription set to cycle on the 2nd of the 
  // month will always be billed on the 2nd.
  get billing_cycle_anchor():Date {
    return new Date(this._subscription.billing_cycle_anchor * 1000 );
  }

  get items():any[]{
    const elements = this._subscription.items.data.map(parseItem);
    return elements;
  }

  //
  // return the date of the next billing
  getNextBillingDay() {
    const dayOfBilling = this.billing_cycle_anchor;
    const today = new Date();
    const month = (today.getDate()> dayOfBilling.getDate())? today.getMonth()+1:today.getMonth();
    const billing = new Date(today.getFullYear(),month,dayOfBilling.getDate());
    return { billing, dayOfWeek: this.shipping.dayOfWeek};
  }

  //
  // update the billing_cycle_anchor for the next billing (min 2 days before the next delivery)
  // async setNextBillingDay(billing: Date) {
  //   const customer = this._subscription.customer as string;
  //   const subscription = await $stripe.subscriptions.update(
  //     customer,
  //     {billing_cycle_anchor: billing, proration_behavior: 'create_prorations'}
  //   );
  // }


  //
  // Cancel (delete) subscription at end of (paid) cycle
  // that is, for the duration of time the customer has already paid for
  // https://stripe.com/docs/billing/subscriptions/cancel?dashboard-or-api=api#cancel-at-end-of-cycle
  async cancel(){
    // await $stripe.subscriptions.del(this._subscription.id)
    this._subscription = await $stripe.subscriptions.update(
      this._subscription.id,{cancel_at_period_end: true}
    );
  }

  //
  // update the contract with  karibou cart items
  // replaces the previous contract with the new items and price 
  async updateItemsAndPrice(cardTtems) {

  }

  //
  // set the subscription on pause, 
  // sub will pause on {from} Date ({from} billing must be aligned with the billing_cycle_anchor to avoid confusion)
  // sub will resume on {to} Date ({to} billing must be aligned 2-3 days before the dayOfWeek delivery) 
  // https://stripe.com/docs/billing/subscriptions/pause
  async pause(to:Date) {
    const customer = this._subscription.customer as string;
    const metadata = this._subscription.metadata;

    // Stripe won’t send any upcoming invoice emails or webhooks for these invoices 
    // and the subscription’s status remains unchanged.
    const behavior:any ={
      behavior: 'void'
    }
    //
    // be sure (in frontend) that resume time is 2-3 days before the next shipping day
    if (to){
      if(!to.toDateString) throw new Error("resume date is incorrect");
      metadata.to = to.getTime()+'';
      behavior.resumes_at=to.getTime();
    }

    metadata.from = Date.now()+'';

    this._subscription = await $stripe.subscriptions.update(
      this._subscription.id,
      {pause_collection: behavior}
    );
  }


  async resumeManualy(){
    const metadata = this._subscription.metadata;
    metadata.from = undefined;
    metadata.to = undefined;
    this._subscription = await $stripe.subscriptions.update(
      this._subscription.id, {pause_collection: '', metadata}
    );


  }

  //
  // create one subscription by recurring interval (mobth, day, week)
  // https://stripe.com/docs/api/subscriptions
  //
  // - check status and content of subscription before to create a new one
  // - check that cart id exist and bellongd to this customer
  // - allow_incomplete, pending_if_incomplete or error_if_incomplete
  //   https://stripe.com/docs/api/subscriptions/create#create_subscription-payment_behavior
  // - collection_method = charge_automatically or send_invoice
  // - days_until_due, Number of days a customer has to pay invoices
  //
  //
  // - multiple subscription for 
  //   https://stripe.com/docs/billing/subscriptions/multiple-products#multiple-subscriptions-for-a-customer
  //   note: use the same billing_cycle_anchor for the same customer
  static async create(customer:Customer, card:Card, interval:Interval, start_from, shipping:SubscriptionAddress, cartItems, dayOfWeek, fees) {
    
    // check Date instance
    assert(start_from && start_from.toDateString);
    assert(shipping.price);
    assert(shipping.lat);
    assert(shipping.lng);

    // check is subscription must be updated or created
    for(let item of cartItems) {
      item.product = await findOrCreateProductFromItem(item);
    }
    // group items by interval, day, week, month
    const items = createItemsFromCart(cartItems,fees);

    //
    // create metadata karibou model
    // https://github.com/karibou-ch/karibou-api/wiki/1.4-Paiement-par-souscription
    const metadata = {address: JSON.stringify(shipping,null,0),dayOfWeek};

    const description = "Contrat : " + interval;
    // FIXME, manage SCA or pexpired card in subscripton workflow
    //
    // payment_behavior for 3ds or expired card 
    // - pending_if_incomplete is used when update existing subscription
    // - allow_incomplete accept subscript delegate the payment in external process
    const options = {
      customer: customer.id,
      payment_behavior:'allow_incomplete',
      default_payment_method:unxor(card.id),
      off_session:true,
      description,
      billing_cycle_anchor: start_from, // 3 days before the 1st tuesday of the next week/month
      items:items[interval],
      metadata 
    } as Stripe.SubscriptionCreateParams;
    try{
      //Config.option('debug') && console.log('---- DBG subscriptions.create',JSON.stringify(options,null,2));
      const subscription = await $stripe.subscriptions.create(options);    
      return new SubscriptionContract(subscription);  
    }catch(err) {
      throw parseError(err);
    }
  }

  //
  // update a subscription when item price has changed
  // -- https://stripe.com/docs/billing/subscriptions/pending-updates#update-subscription


  //
  // manage souscription from webhook or customer action
  // https://stripe.com/docs/billing/subscriptions/webhooks#events
  // main events,
  // - customer.subscription.paused	
  // - customer.subscription.resumed	
  // - customer.subscription.updated	
  // - payment_intent.created	
  // - payment_intent.succeeded	

  //
  // load all subscript for this customer
  // - format content for customer presentation 
  static async list(customer:Customer) {

    // constraint subscription by date {created: {gt: Date.now()}}
    const subscriptions:Stripe.ApiList<Stripe.Subscription> = await $stripe.subscriptions.list({
      customer:customer.id
    });

    //
    // wrap stripe subscript to karibou 
    return subscriptions.data.map(sub => new SubscriptionContract(sub))
  }

  //
  // active, unpaid, incomplete, paused
  static async listAll(options) {
    if(!options.active && !options.unpaid && !options.incomplete && !options.paused) {
      throw new Error("Subscription list params error");
    }
    // constraint subscription by date {created: {gt: Date.now()}}
    const subscriptions:Stripe.ApiList<Stripe.Subscription> = await $stripe.subscriptions.list(options);

    //
    // wrap stripe subscript to karibou 
    return subscriptions.data.map(sub => new SubscriptionContract(sub))

  }  
}

//
// Stripe need to attach a valid product for a subscription
async function findOrCreateProductFromItem(item) {
  const product = await $stripe.products.search({
    query:"active:'true' AND name:'"+item.sku+"'", limit:1
  })
  if(product && product.data.length) {
    return product.data[0].id;
  }

  const created = await $stripe.products.create({
    name: item.sku,
    description:item.title + "(" + item.part + ")"
  });
  return created.id;
}

//
// only for week or month subscription
// day subscription is a special case
function createItemsFromCart(cartItems, fees) {
  const itemCreation = (item, interval ) => {
    const interval_count = {
      'week':1,
      'month':1
    }
    const metadata:SubscriptionMetaItem ={
      sku : item.sku,
      quantity: item.quantity,
      title : item.title,
      part : item.part,
      hub : item.hub,
      note : item.note,
      fees
    }

    const price = (item.price * (1 + fees) * 100).toFixed(0);

    //
    // missing fees (see documentation for fees inclusion)
    const instance:SubscriptionItem = { 
      currency : 'CHF', 
      unit_amount : parseInt(price),                
      product : item.product,
      recurring : { interval, interval_count: interval_count[interval] }
    };

    return {metadata, quantity: item.quantity,price_data:instance};
  }

  //
  // prepare items for Stripe Schedule
  const week = cartItems.filter(item => item.frequency == SchedulerItemFrequency.RECURRENT_WEEK).map(i => itemCreation(i,'week'));
  const month = cartItems.filter(item => item.frequency == SchedulerItemFrequency.RECURRENT_MONTH).map(i => itemCreation(i,'month'));

  return {week,month};
}


//
// parse subscription Item
function parseItem(item: Stripe.SubscriptionItem) {
  return {
    unit_amount:item.price.unit_amount,
    currency:item.price.currency,
    quantity:(item.quantity),
    dayOfWeek:parseInt(item.metadata.dayOfWeek),
    fees:parseFloat(item.metadata.fees),
    hub:item.metadata.hub,
    note:item.metadata.note,
    part:item.metadata.part,
    sku:item.metadata.sku,
    title:item.metadata.title
  }
}

//
// parse scheduled shipping
function parseShipping(metadata) {
  try{
    const address = JSON.parse(metadata['address']) as SubscriptionAddress;
    address.dayOfWeek = parseInt(metadata['dayOfWeek'])
    return address;
  }catch(err){
    console.log('---- DBG error parseAddress',err);
    throw err;
  }
}

function parseError(err) {
  Config.option('debug') && console.log('---- DBG error',err);
  return new Error(err);
}
