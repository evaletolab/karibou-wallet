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
exports.Transaction = void 0;
const assert_1 = require("assert");
const payments_1 = require("./payments");
class Transaction {
    constructor(payment, refund) {
        this._payment = payment;
        this._refund = refund || {};
        this._report = {};
    }
    get id() {
        return (0, payments_1.xor)(this._payment.id);
    }
    get oid() {
        return (this._payment.metadata.order);
    }
    get paymentId() {
        return (0, payments_1.xor)(this._payment.payment_method);
    }
    get customer() {
        return this._payment.customer;
    }
    get amount() {
        const _amount = this.captured ? this._payment.amount_received : this._payment.amount;
        return parseFloat((_amount / 100).toFixed(2));
    }
    get group() {
        return this._payment.transfer_group;
    }
    get currency() {
        return this._payment.currency;
    }
    get description() {
        return this._payment.description;
    }
    get requiresAction() {
        return this._payment.status == "requires_action";
    }
    get authorized() {
        return this._payment.status == "requires_capture";
    }
    get captured() {
        return this._payment.status == "succeeded";
    }
    get canceled() {
        return this._payment.status == "canceled";
    }
    get refunded() {
        const _refunded = parseInt(this._payment.metadata.refund || "0");
        return parseFloat((_refunded / 100).toFixed(2));
    }
    get report() {
        let now = new Date(this._payment.created * 1000);
        let amount = this.amount;
        let status;
        switch (this._payment.status) {
            case 'requires_action':
                status = 'requires_action';
                break;
            case 'canceled':
                status = 'cancel';
                break;
            case 'requires_capture':
                status = 'authorized';
                break;
            case 'succeeded':
                status = 'captured';
                break;
        }
        if (this._refund.amount) {
            amount = parseFloat((this._refund.amount / 100).toFixed(2));
            status = 'refund';
            now = new Date();
        }
        return {
            log: status + ' ' + (this.amount) + ' ' + this.currency + ' the ' + now.toDateString(),
            transaction: (this.id),
            updated: Date.now(),
            provider: 'stripe'
        };
    }
    static authorize(customer, card, amount, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const amount_capturable = Math.round(amount * 100);
            const tx_description = "#" + options.oid + " for " + options.email;
            const tx_group = options.txgroup;
            const shipping = {
                address: {
                    line1: options.shipping.streetAdress,
                    postal_code: options.shipping.postalCode,
                    country: 'CH'
                },
                name: options.shipping.name
            };
            const transaction = yield payments_1.$stripe.paymentIntents.create({
                amount: amount_capturable,
                currency: "CHF",
                customer: customer.id,
                payment_method: (0, payments_1.unxor)(card.id),
                transfer_group: tx_group,
                off_session: false,
                capture_method: 'manual',
                confirm: true,
                shipping: shipping,
                description: tx_description,
                metadata: {
                    order: options.oid
                },
            });
            return new Transaction(transaction);
        });
    }
    static get(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const tid = (0, payments_1.unxor)(id);
            const transaction = yield payments_1.$stripe.paymentIntents.retrieve(tid);
            (0, assert_1.strict)(transaction.customer);
            return new Transaction(transaction);
        });
    }
    static confirm(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const tid = (0, payments_1.unxor)(id);
            const transaction = yield payments_1.$stripe.paymentIntents.update(tid);
            (0, assert_1.strict)(transaction.customer);
            return new Transaction(transaction);
        });
    }
    capture(amount) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.canceled) {
                return Promise.reject(new Error("Transaction canceled."));
            }
            if (this.captured) {
                return Promise.reject(new Error("Transaction already captured."));
            }
            if (!this.authorized) {
                return Promise.reject(new Error("Transaction need to be authorized."));
            }
            if (amount == undefined) {
                return Promise.reject(new Error("Transaction need to an minimal amount to proceed"));
            }
            const _recapture = (amount) => {
                const paymentId = (0, payments_1.unxor)(this.paymentId);
                console.log(' -- WARNING: charge has expired, create a new one with the ref ' + (this.customer) + '/' + (this.paymentId));
                const shipping = {
                    address: {
                        line1: this._payment.shipping.address.line1,
                        postal_code: this._payment.shipping.address.postal_code,
                        country: 'CH'
                    },
                    name: this._payment.shipping.name
                };
                return payments_1.$stripe.paymentIntents.create({
                    amount: amount,
                    currency: "CHF",
                    customer: (this.customer),
                    payment_method: paymentId,
                    transfer_group: this.group,
                    off_session: true,
                    capture_method: 'automatic',
                    confirm: true,
                    shipping: shipping,
                    description: this._payment.description,
                    metadata: {
                        order: this.oid
                    }
                });
            };
            amount = Math.round(amount * 100);
            try {
                if (amount < 1.0) {
                    this._payment = yield payments_1.$stripe.paymentIntents.cancel(this._payment.id);
                }
                else {
                    this._payment = yield payments_1.$stripe.paymentIntents.capture(this._payment.id, {
                        amount_to_capture: amount
                    });
                }
                return this;
            }
            catch (err) {
                const msg = err.message || err;
                if (msg.indexOf('Only a PaymentIntent with one of the following statuses may be canceled') > -1) {
                    const result = {
                        log: 'cancel ' + this.oid + ' , from ' + new Date(this._payment.created),
                        transaction: (0, payments_1.xor)(this._payment.id),
                        updated: Date.now(),
                        provider: 'stripe'
                    };
                    return result;
                }
                if (msg.indexOf('PaymentIntent could not be captured because it has a status of canceled') == -1 &&
                    msg.indexOf(' the charge has expired') == -1) {
                    throw new Error(err);
                }
                this._payment = yield _recapture(amount);
                return this;
            }
        });
    }
    cancel() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.captured) {
                new Error("Impossible to cancel captured transaction, try to refund.");
            }
            try {
                this._payment = yield payments_1.$stripe.paymentIntents.cancel(this.id);
                return this;
            }
            catch (err) {
                throw parseError(err);
            }
        });
    }
    refund(amount) {
        return __awaiter(this, void 0, void 0, function* () {
            amount = Math.round(amount * 100);
            if (this.canceled) {
                return Promise.reject(new Error("Transaction canceled."));
            }
            if (!this.captured) {
                return Promise.reject(new Error("Transaction cannot be refunded before capture, try to cancel."));
            }
            if (amount != undefined && amount == 0) {
                throw new Error('Aucun montant a rembourser');
            }
            try {
                if (amount > 0) {
                    this._refund = yield payments_1.$stripe.refunds.create({
                        payment_intent: this._payment.id,
                        amount: amount,
                        metadata: {
                            order: this.oid
                        }
                    });
                }
                else {
                    this._refund = yield payments_1.$stripe.refunds.create({
                        payment_intent: this._payment.id,
                        metadata: {
                            order: this.oid
                        }
                    });
                }
                this._payment = yield payments_1.$stripe.paymentIntents.update(this._payment.id, {
                    metadata: { refund: (this._refund.amount + this.refunded * 100) }
                });
                return this;
            }
            catch (err) {
                throw parseError(err);
            }
        });
    }
}
exports.Transaction = Transaction;
function parseError(err) {
    throw new Error(err);
}
//# sourceMappingURL=transaction.js.map