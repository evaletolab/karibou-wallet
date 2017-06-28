"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
const stripeLib = require("stripe");
const stripe = stripeLib(config_1.Config.option('privatekey'));
class Account {
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
        if ("stripeAccid" in tmp)
            this.stripeAccid = tmp.stripeAccid;
        else
            throw new Error("Missing parameter: Stripe account id");
        this.address = tmp.address;
        this.city = tmp.city;
        this.postalCode = tmp.postalCode;
        this.company = tmp.company;
    }
    static create(stripeAccid) {
        return stripe.accounts.retrieve(stripeAccid).then((account) => {
            var custJson = JSON.stringify({
                stripeAccid: account.id,
                email: account.email,
                lastname: account.legal_entity.last_name,
                firstname: account.legal_entity.first_name,
                address: account.legal_entity.address.line1,
                postalCode: account.legal_entity.address.postal_code,
                city: account.legal_entity.address.city,
                company: account.business_name
            });
            return new Account(custJson);
        }).catch(parseError);
    }
    save() {
        return JSON.stringify(this);
    }
    getTransferList(limit = 10, transferOffset) {
        if (transferOffset != undefined)
            return stripe.transfers.list({ account: this.stripeAccid, limit: limit, starting_after: transferOffset }).catch(parseError);
        else
            return stripe.transfers.list({ account: this.stripeAccid, limit: limit }).catch(parseError);
    }
}
exports.Account = Account;
function parseError(err) {
    throw new Error(err);
}
//# sourceMappingURL=account.js.map