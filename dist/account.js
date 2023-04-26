"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Account = void 0;
const payments_1 = require("./payments");
class Account {
    constructor(params) {
        if ("email" in params)
            this._email = params.email;
        else
            throw new Error("Missing parameter: email");
        if ("id" in params)
            this._id = params.id;
        else
            throw new Error("Missing parameter: Stripe account id");
        this._lastname = params.lastname;
        this._firstname = params.firstname;
        this._address = params.address;
        this._city = params.city;
        this._postalCode = params.postalCode;
        this._company = params.company;
    }
    get id() {
        return this.id;
    }
    static create(id) {
    }
    save() {
        return JSON.stringify(this);
    }
    getTransferList(limit = 10, transferOffset) {
        if (transferOffset != undefined)
            return payments_1.$stripe.transfers.list({ destination: this.id, limit: limit, starting_after: transferOffset }).catch(parseError);
        else
            return payments_1.$stripe.transfers.list({ destination: this.id, limit: limit }).catch(parseError);
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