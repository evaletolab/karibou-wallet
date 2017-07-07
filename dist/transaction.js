"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
const stripeLib = require("stripe");
const customer_1 = require("./customer");
const stripe = stripeLib(config_1.Config.option('privatekey'));
class Transaction {
    constructor(cust, amount, groupId, description) {
        this.cust = cust;
        this.groupId = groupId;
        this.amount = amount;
        this.description = description;
        this.authorized = false;
        this.captured = false;
        this.canceled = false;
        this.amountRefunded = 0;
        this.id = undefined;
    }
    static load(params) {
        var newTransac = new Transaction(new customer_1.Customer(JSON.stringify(params.cust)), params.amount, params.groupId, params.description);
        if ("id" in params) {
            return stripe.charges.retrieve(params.id).then((charge) => {
                newTransac.authorized = true;
                newTransac.captured = charge.captured;
                newTransac.canceled = params.canceled;
                newTransac.amountRefunded = charge.amount_refunded;
                newTransac.id = params.id;
                return newTransac;
            }).catch(parseError);
        }
        else {
            return Promise.resolve().then(() => {
                return newTransac;
            });
        }
    }
    save() {
        return JSON.stringify(this);
    }
    auth() {
        if (this.canceled)
            return Promise.reject(new Error("Transaction canceled."));
        if (this.authorized)
            return Promise.reject(new Error("Transaction already authorized."));
        return stripe.charges.create({
            amount: this.amount,
            currency: "chf",
            capture: false,
            customer: this.cust.getId(),
            transfer_group: this.groupId
        }).then((charge) => {
            this.authorized = true;
            this.id = charge.id;
        }).catch(parseError);
    }
    capture() {
        if (this.canceled)
            return Promise.reject(new Error("Transaction canceled."));
        if (this.captured)
            return Promise.reject(new Error("Transaction already captured."));
        if (!this.authorized)
            return Promise.reject(new Error("Transaction need to be authorized."));
        return stripe.charges.capture(this.id).then(() => {
            this.captured = true;
        }).catch(parseError);
    }
    cancel() {
        if (this.captured)
            new Error("Impossible to cancel captured transaction, try to refund.");
        this.canceled = true;
    }
    refund(amount) {
        if (this.canceled)
            return Promise.reject(new Error("Transaction canceled."));
        if (!this.captured)
            return Promise.reject(new Error("Transaction cannot be refunded before capture, try to cancel."));
        if (this.amountRefunded === this.amount)
            return Promise.reject(new Error("Transaction already fully refunded."));
        if ((amount !== undefined) && (amount > this.amount - this.amountRefunded))
            return Promise.reject(new Error("The refund amount is bigger than the amount left."));
        if (amount === undefined) {
            return stripe.refunds.create({ charge: this.id }).then((refund) => {
                this.amountRefunded += refund.amount;
            }).catch(parseError);
        }
        else {
            return stripe.refunds.create({ charge: this.id, amount: amount }).then((refund) => {
                this.amountRefunded += refund.amount;
            }).catch(parseError);
        }
    }
    isAuthorized() {
        return this.authorized;
    }
    isCaptured() {
        return this.captured;
    }
    isCanceled() {
        return this.canceled;
    }
    getTransactionAmount() {
        return this.amount;
    }
    getAmountRefunded() {
        return this.amountRefunded;
    }
    getId() {
        return this.id;
    }
}
exports.Transaction = Transaction;
function parseError(err) {
    throw new Error(err);
}
//# sourceMappingURL=transaction.js.map