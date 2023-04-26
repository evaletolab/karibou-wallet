import Stripe from 'stripe';
import { Card, Customer } from './customer';
import { Address } from './payments';
export type Interval = Stripe.Plan.Interval;
export interface SubscriptionMetaItem {
    sku: string | number;
    quantity: number;
    title: string;
    part: string;
    hub: string;
    note: string;
    fees: number;
}
export interface SubscriptionItem {
    currency: string;
    unit_amount: number;
    product: string;
    recurring: {
        interval: Interval;
        interval_count: number;
    };
    metadata?: SubscriptionMetaItem;
}
export declare enum SchedulerStatus {
    active = 1,
    paused = 2,
    pending = 3,
    closed = 4
}
export declare enum SchedulerItemFrequency {
    RECURRENT_NONE = 0,
    RECURRENT_DAY = 1,
    RECURRENT_WEEK = 2,
    RECURRENT_2WEEKS = 3,
    RECURRENT_MONTH = 4
}
export interface SubscriptionAddress extends Address {
    price: number;
    dayOfWeek?: number;
}
export declare class SubscriptionContract {
    private _subscription;
    private _status;
    private _id;
    private _interval;
    private _interval_count;
    private constructor();
    get id(): string;
    get interval(): {
        start: Date;
        bill: Stripe.Plan.Interval;
        count: number;
    };
    get status(): "paused" | Stripe.Subscription.Status;
    get description(): any;
    get pausedUntil(): number;
    get shipping(): SubscriptionAddress;
    get billing_cycle_anchor(): Date;
    get items(): any[];
    getNextBillingDay(): {
        billing: Date;
        dayOfWeek: number;
    };
    cancel(): Promise<void>;
    updateItemsAndPrice(cardTtems: any): Promise<void>;
    pause(to: Date): Promise<void>;
    resumeManualy(): Promise<void>;
    static create(customer: Customer, card: Card, interval: Interval, start_from: any, shipping: SubscriptionAddress, cartItems: any, dayOfWeek: any, fees: any): Promise<SubscriptionContract>;
    static list(customer: Customer): Promise<SubscriptionContract[]>;
    static listAll(options: any): Promise<SubscriptionContract[]>;
}
