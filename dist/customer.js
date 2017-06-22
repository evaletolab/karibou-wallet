"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
const stripeLib = require("stripe");
const payments_enum_1 = require("./payments.enum");
const stripe = stripeLib(config_1.Config.option('privatekey'));
class Customer {
    constructor(json) {
        let tmp = JSON.parse(json);
        if ("email" in tmp)
            this.email = tmp.email;
        else
            throw new Error("Missing parameter: email");
        if ("lastname" in tmp)
            this.lastname = tmp.lastname;
        else
            throw new Error("Missing parameter: lastname");
        if ("firstname" in tmp)
            this.firstname = tmp.firstname;
        else
            throw new Error("Missing parameter: firstname");
        this.stripeCusid = null;
        this.sources = [];
        if ("stripeCusid" in tmp)
            this.stripeCusid = tmp.stripeCusid;
        if ("sources" in tmp)
            this.sources = tmp.sources;
        this.map = {};
        this.map[payments_enum_1.Payment.card] = 'card';
        this.map[payments_enum_1.Payment.sepa] = 'sepa_debit';
        this.map[payments_enum_1.Payment.bitcoin] = 'bitcoin';
    }
    static create(email, lastname, firstname) {
        return stripe.customers.create({
            description: lastname + ' ' + firstname,
            email: email
        }).then((customerStripe) => {
            var custJson = JSON.stringify({
                email: email,
                lastname: lastname,
                firstname: firstname,
                stripeCusid: customerStripe.id
            });
            return new Customer(custJson);
        }).catch(parseError);
    }
    save() {
        var json;
        return JSON.stringify(this);
    }
    addPayment(sourceData, token) {
        if (!(sourceData.type in this.map))
            throw new Error("Unknown payment type");
        var newSourceData = Object.assign({}, sourceData);
        if (newSourceData.type == payments_enum_1.Payment.card) {
            return stripe.customers.createSource(this.stripeCusid, { source: token }).then((card) => {
                var newCard = {
                    type: payments_enum_1.Payment.card,
                    sourceId: card.id,
                    owner: newSourceData.owner,
                    brand: card.brand,
                    exp_year: card.exp_year,
                    exp_month: card.exp_month,
                    last4: card.last4
                };
                this.sources.push(newCard);
            }).catch(parseError);
        }
        else {
            throw new Error("Unknown payment type");
        }
    }
    updatePayment(sourceId, sourceData) {
        let index = -1;
        for (let i in this.sources) {
            if (this.sources[i].sourceId == sourceId) {
                index = Number(i);
                break;
            }
        }
        this.sources[index] = sourceData;
    }
    removePayment(sourceId) {
        var index = -1;
        for (let i in this.sources) {
            if (this.sources[i].sourceId == sourceId) {
                index = Number(i);
                break;
            }
        }
        if (index !== -1) {
            return stripe.customers.deleteCard(this.stripeCusid, this.sources[index].sourceId).then(() => {
                this.sources.splice(index, 1);
            }).catch(parseError);
        }
        else {
            throw new Error("Source ID not found");
        }
    }
    getPaymentList() {
        var paymentList = [];
        var promiseList = [];
        for (let i in this.sources) {
            switch (this.sources[i].type) {
                case payments_enum_1.Payment.card:
                    promiseList.push(stripe.customers.retrieveCard(this.stripeCusid, this.sources[i].sourceId).then((source) => {
                        paymentList.push(source);
                    }).catch(parseError));
                    break;
                default:
                    throw new Error("Unknown payment type");
            }
        }
        return Promise.all(promiseList).then(function () { return paymentList; });
    }
    setStripePayment(sourceId) {
        var index = -1;
        for (let i in this.sources) {
            if (this.sources[i].sourceId == sourceId) {
                index = Number(i);
                break;
            }
        }
        if (index > -1) {
            return stripe.customers.update(this.stripeCusid, { default_source: sourceId }).catch(parseError);
        }
        else {
            throw new Error("Source not present in the customer");
        }
    }
    getChargeList() {
        return stripe.charges.list({ customer: this.stripeCusid }).catch(parseError);
    }
}
exports.Customer = Customer;
function parseError(err) {
    throw new Error(err);
}
//# sourceMappingURL=customer.js.map