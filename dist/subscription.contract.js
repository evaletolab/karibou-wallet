"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionContract = exports.SchedulerItemFrequency = exports.SchedulerStatus = void 0;
const assert_1 = require("assert");
const payments_1 = require("./payments");
const config_1 = require("./config");
var SchedulerStatus;
(function (SchedulerStatus) {
    SchedulerStatus[SchedulerStatus["active"] = 1] = "active";
    SchedulerStatus[SchedulerStatus["paused"] = 2] = "paused";
    SchedulerStatus[SchedulerStatus["pending"] = 3] = "pending";
    SchedulerStatus[SchedulerStatus["closed"] = 4] = "closed";
})(SchedulerStatus = exports.SchedulerStatus || (exports.SchedulerStatus = {}));
var SchedulerItemFrequency;
(function (SchedulerItemFrequency) {
    SchedulerItemFrequency[SchedulerItemFrequency["RECURRENT_NONE"] = 0] = "RECURRENT_NONE";
    SchedulerItemFrequency[SchedulerItemFrequency["RECURRENT_DAY"] = 1] = "RECURRENT_DAY";
    SchedulerItemFrequency[SchedulerItemFrequency["RECURRENT_WEEK"] = 2] = "RECURRENT_WEEK";
    SchedulerItemFrequency[SchedulerItemFrequency["RECURRENT_2WEEKS"] = 3] = "RECURRENT_2WEEKS";
    SchedulerItemFrequency[SchedulerItemFrequency["RECURRENT_MONTH"] = 4] = "RECURRENT_MONTH";
})(SchedulerItemFrequency = exports.SchedulerItemFrequency || (exports.SchedulerItemFrequency = {}));
class SubscriptionContract {
    constructor(subs) {
        this._subscription = subs;
        this._interval = this._subscription.items.data[0].plan.interval;
        this._interval_count = this._subscription.items.data[0].plan.interval_count;
    }
    get id() { return this._subscription.id; }
    get interval() {
        return {
            start: this.billing_cycle_anchor,
            bill: this._interval,
            count: this._interval_count
        };
    }
    get status() {
        if (this._subscription.pause_collection) {
            return 'paused';
        }
        return this._subscription.status;
    }
    get description() { return this._subscription.description; }
    get pausedUntil() {
        if (this._subscription.pause_collection && this._subscription.pause_collection.resumes_at) {
            return (this._subscription.pause_collection.resumes_at) || 0;
        }
        return 0;
    }
    get shipping() {
        return parseShipping(this._subscription.metadata);
    }
    get billing_cycle_anchor() {
        return new Date(this._subscription.billing_cycle_anchor * 1000);
    }
    get items() {
        const elements = this._subscription.items.data.map(parseItem);
        return elements;
    }
    getNextBillingDay() {
        const dayOfBilling = this.billing_cycle_anchor;
        const today = new Date();
        const month = (today.getDate() > dayOfBilling.getDate()) ? today.getMonth() + 1 : today.getMonth();
        const billing = new Date(today.getFullYear(), month, dayOfBilling.getDate());
        return { billing, dayOfWeek: this.shipping.dayOfWeek };
    }
    cancel() {
        return __awaiter(this, void 0, void 0, function* () {
            this._subscription = yield payments_1.$stripe.subscriptions.update(this._subscription.id, { cancel_at_period_end: true });
        });
    }
    updateItemsAndPrice(cardTtems) {
        return __awaiter(this, void 0, void 0, function* () {
        });
    }
    pause(to) {
        return __awaiter(this, void 0, void 0, function* () {
            const customer = this._subscription.customer;
            const metadata = this._subscription.metadata;
            const behavior = {
                behavior: 'void'
            };
            if (to) {
                if (!to.toDateString)
                    throw new Error("resume date is incorrect");
                metadata.to = to.getTime() + '';
                behavior.resumes_at = to.getTime();
            }
            metadata.from = Date.now() + '';
            this._subscription = yield payments_1.$stripe.subscriptions.update(this._subscription.id, { pause_collection: behavior });
        });
    }
    resumeManualy() {
        return __awaiter(this, void 0, void 0, function* () {
            const metadata = this._subscription.metadata;
            metadata.from = undefined;
            metadata.to = undefined;
            this._subscription = yield payments_1.$stripe.subscriptions.update(this._subscription.id, { pause_collection: '', metadata });
        });
    }
    static create(customer, card, interval, start_from, shipping, cartItems, dayOfWeek, fees) {
        return __awaiter(this, void 0, void 0, function* () {
            (0, assert_1.strict)(start_from && start_from.toDateString);
            (0, assert_1.strict)(shipping.price);
            (0, assert_1.strict)(shipping.lat);
            (0, assert_1.strict)(shipping.lng);
            for (let item of cartItems) {
                item.product = yield findOrCreateProductFromItem(item);
            }
            const items = createItemsFromCart(cartItems, fees);
            const metadata = { address: JSON.stringify(shipping, null, 0), dayOfWeek };
            const description = "Contrat : " + interval;
            const options = {
                customer: customer.id,
                payment_behavior: 'allow_incomplete',
                default_payment_method: (0, payments_1.unxor)(card.id),
                off_session: true,
                description,
                billing_cycle_anchor: start_from,
                items: items[interval],
                metadata
            };
            try {
                const subscription = yield payments_1.$stripe.subscriptions.create(options);
                return new SubscriptionContract(subscription);
            }
            catch (err) {
                throw parseError(err);
            }
        });
    }
    static list(customer) {
        return __awaiter(this, void 0, void 0, function* () {
            const subscriptions = yield payments_1.$stripe.subscriptions.list({
                customer: customer.id
            });
            return subscriptions.data.map(sub => new SubscriptionContract(sub));
        });
    }
    static listAll(options) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!options.active && !options.unpaid && !options.incomplete && !options.paused) {
                throw new Error("Subscription list params error");
            }
            const subscriptions = yield payments_1.$stripe.subscriptions.list(options);
            return subscriptions.data.map(sub => new SubscriptionContract(sub));
        });
    }
}
exports.SubscriptionContract = SubscriptionContract;
function findOrCreateProductFromItem(item) {
    return __awaiter(this, void 0, void 0, function* () {
        const product = yield payments_1.$stripe.products.search({
            query: "active:'true' AND name:'" + item.sku + "'", limit: 1
        });
        if (product && product.data.length) {
            return product.data[0].id;
        }
        const created = yield payments_1.$stripe.products.create({
            name: item.sku,
            description: item.title + "(" + item.part + ")"
        });
        return created.id;
    });
}
function createItemsFromCart(cartItems, fees) {
    const itemCreation = (item, interval) => {
        const interval_count = {
            'week': 1,
            'month': 1
        };
        const metadata = {
            sku: item.sku,
            quantity: item.quantity,
            title: item.title,
            part: item.part,
            hub: item.hub,
            note: item.note,
            fees
        };
        const price = (item.price * (1 + fees) * 100).toFixed(0);
        const instance = {
            currency: 'CHF',
            unit_amount: parseInt(price),
            product: item.product,
            recurring: { interval, interval_count: interval_count[interval] }
        };
        return { metadata, quantity: item.quantity, price_data: instance };
    };
    const week = cartItems.filter(item => item.frequency == SchedulerItemFrequency.RECURRENT_WEEK).map(i => itemCreation(i, 'week'));
    const month = cartItems.filter(item => item.frequency == SchedulerItemFrequency.RECURRENT_MONTH).map(i => itemCreation(i, 'month'));
    return { week, month };
}
function parseItem(item) {
    return {
        unit_amount: item.price.unit_amount,
        currency: item.price.currency,
        quantity: (item.quantity),
        dayOfWeek: parseInt(item.metadata.dayOfWeek),
        fees: parseFloat(item.metadata.fees),
        hub: item.metadata.hub,
        note: item.metadata.note,
        part: item.metadata.part,
        sku: item.metadata.sku,
        title: item.metadata.title
    };
}
function parseShipping(metadata) {
    try {
        const address = JSON.parse(metadata['address']);
        address.dayOfWeek = parseInt(metadata['dayOfWeek']);
        return address;
    }
    catch (err) {
        console.log('---- DBG error parseAddress', err);
        throw err;
    }
}
function parseError(err) {
    config_1.default.option('debug') && console.log('---- DBG error', err);
    return new Error(err);
}
//# sourceMappingURL=subscription.contract.js.map