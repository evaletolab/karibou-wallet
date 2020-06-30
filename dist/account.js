"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
const stripeLib = require("stripe");
const stripe = stripeLib(config_1.Config.option('privatekey'));
class Account {
    constructor(params) {
        if ("email" in params)
            this.email = params.email;
        else
            throw new Error("Missing parameter: email");
        if ("id" in params)
            this.id = params.id;
        else
            throw new Error("Missing parameter: Stripe account id");
        this.lastname = params.lastname;
        this.firstname = params.firstname;
        this.address = params.address;
        this.city = params.city;
        this.postalCode = params.postalCode;
        this.company = params.company;
    }
    static create(id) {
        return stripe.accounts.retrieve(id).then((account) => {
            var custJson = JSON.stringify({
                id: account.id,
                email: account.email,
                lastname: account.legal_entity.last_name,
                firstname: account.legal_entity.first_name,
                address: account.legal_entity.address.line1,
                postalCode: account.legal_entity.address.postal_code,
                city: account.legal_entity.address.city,
                company: account.business_name
            });
            return new Account(JSON.parse(custJson));
        }).catch(parseError);
    }
    save() {
        return JSON.stringify(this);
    }
    getTransferList(limit = 10, transferOffset) {
        if (transferOffset != undefined)
            return stripe.transfers.list({ destination: this.id, limit: limit, starting_after: transferOffset }).catch(parseError);
        else
            return stripe.transfers.list({ destination: this.id, limit: limit }).catch(parseError);
    }
    getId() {
        return this.id;
    }
}
exports.Account = Account;
function parseError(err) {
    throw new Error(err);
}
//# sourceMappingURL=account.js.map