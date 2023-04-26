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
exports.Customer = void 0;
const assert_1 = require("assert");
const payments_1 = require("./payments");
const config_1 = require("./config");
class Customer {
    constructor(id, email, phone, metadata) {
        (0, assert_1.strict)(id);
        (0, assert_1.strict)(email);
        (0, assert_1.strict)(phone);
        (0, assert_1.strict)(metadata.uid);
        (0, assert_1.strict)(metadata.fname);
        (0, assert_1.strict)(metadata.lname);
        this._email = email;
        this._phone = phone;
        this._fname = metadata.fname;
        this._lname = metadata.lname;
        this._uid = metadata.uid;
        this._id = id;
        this._metadata = metadata;
        this._sources = [];
        this._addresses = parseAddress(metadata);
    }
    get id() {
        return (this._id);
    }
    get email() {
        return this._email;
    }
    get phone() {
        return this._phone;
    }
    get name() {
        return {
            familyName: this._fname,
            givenName: this._lname
        };
    }
    get uid() {
        return this._uid;
    }
    get addresses() {
        return this._addresses.slice();
    }
    get methods() {
        return this._sources.slice();
    }
    static create(email, fname, lname, phone, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const customer = yield payments_1.$stripe.customers.create({
                    description: fname + ' ' + lname + ' id:' + uid,
                    email: email,
                    phone,
                    metadata: { uid, fname, lname }
                });
                return new Customer(customer.id, email, phone, customer.metadata);
            }
            catch (err) {
                throw parseError(err);
            }
        });
    }
    static get(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const stripe = yield payments_1.$stripe.customers.retrieve(id);
                const customer = new Customer(stripe.id, stripe.email, stripe.phone, stripe.metadata);
                yield customer.listMethods();
                return customer;
            }
            catch (err) {
                throw parseError(err);
            }
        });
    }
    addressAdd(address) {
        return __awaiter(this, void 0, void 0, function* () {
            (0, assert_1.strict)(this._metadata.uid);
            (0, assert_1.strict)(this._metadata.fname);
            (0, assert_1.strict)(this._metadata.lname);
            try {
                const keys = metadataElements(this._metadata, 'addr');
                address.id = 'addr-' + keys.length + 1;
                this._metadata[address.id] = JSON.stringify(address, null, 0);
                const customer = yield payments_1.$stripe.customers.update(this._id, { metadata: this._metadata });
                this._metadata = customer.metadata;
                this._addresses = parseAddress(customer.metadata);
            }
            catch (err) {
                throw parseError(err);
            }
        });
    }
    addressRemove(address) {
        return __awaiter(this, void 0, void 0, function* () {
            (0, assert_1.strict)(this._metadata.uid);
            (0, assert_1.strict)(this._metadata.fname);
            (0, assert_1.strict)(this._metadata.lname);
            (0, assert_1.strict)(this._metadata[address.id]);
            try {
                this._metadata[address.id] = null;
                const customer = yield payments_1.$stripe.customers.update(this._id, { metadata: this._metadata });
                this._metadata = customer.metadata;
                this._addresses = parseAddress(customer.metadata);
            }
            catch (err) {
                throw parseError(err);
            }
        });
    }
    addressUpdate(address) {
        return __awaiter(this, void 0, void 0, function* () {
            (0, assert_1.strict)(this._metadata.uid);
            (0, assert_1.strict)(this._metadata.fname);
            (0, assert_1.strict)(this._metadata.lname);
            (0, assert_1.strict)(this._metadata[address.id]);
            try {
                this._metadata[address.id] = JSON.stringify(address, null, 0);
                const customer = yield payments_1.$stripe.customers.update(this._id, { metadata: this._metadata });
                this._metadata = customer.metadata;
                this._addresses = parseAddress(customer.metadata);
            }
            catch (err) {
                throw parseError(err);
            }
        });
    }
    addMethodIntent() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield payments_1.$stripe.setupIntents.create({
                usage: 'off_session',
            });
        });
    }
    addMethod(token) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const method = yield payments_1.$stripe.paymentMethods.attach(token, { customer: this._id });
                const card = parseMethod(method);
                const exist = this._sources.find(method => card.alias == method.alias);
                if (exist) {
                    yield payments_1.$stripe.paymentMethods.detach((0, payments_1.unxor)(exist.id));
                }
                this._sources.push(card);
                return card;
            }
            catch (err) {
                throw parseError(err);
            }
        });
    }
    removeMethod(method) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const index = this._sources.findIndex(src => src.id == method.id);
                if (index == -1) {
                    throw new Error("Source ID not found");
                }
                const card_id = (0, payments_1.unxor)(method.id);
                const isNewImp = (card_id[0] === 'p' && card_id[1] === 'm' && card_id[2] === '_');
                let confirmation;
                if (isNewImp) {
                    confirmation = yield payments_1.$stripe.paymentMethods.detach(card_id);
                    this._sources.splice(index, 1);
                }
                else {
                    confirmation = yield payments_1.$stripe.customers.deleteSource(this._id, card_id);
                    this._sources.splice(index, 1);
                }
                console.log(" --- DBG removeMethod ", confirmation);
            }
            catch (err) {
                throw (parseError(err));
            }
        });
    }
    listMethods() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this._sources = yield payments_1.$stripe.paymentMethods.list({
                    customer: this._id,
                    type: 'card'
                });
                this._sources = this._sources.data.map(parseMethod);
                return this._sources.slice();
            }
            catch (err) {
                throw parseError(err);
            }
        });
    }
    findMethodByAlias(alias) {
        return this._sources.find(card => card.alias == alias);
    }
}
exports.Customer = Customer;
function metadataElements(metadata, key) {
    return Object.keys(metadata).filter(k => k.indexOf(key) > -1);
}
function parseAddress(metadata) {
    const keys = metadataElements(metadata, 'addr');
    const addresses = [];
    keys.forEach(key => {
        try {
            const address = JSON.parse(metadata[key]);
            addresses.push(address);
        }
        catch (err) {
            console.log('---- DBG error parseAddress', err);
        }
    });
    return addresses;
}
function parseError(err) {
    config_1.default.option('debug') && console.log('---- DBG error', err);
    return new Error(err);
}
function parseMethod(method) {
    (0, assert_1.strict)(method);
    const id = (0, payments_1.xor)(method.id);
    method = method.card || method;
    const alias = (0, payments_1.xor)(method.fingerprint);
    return {
        id: id,
        alias: alias,
        country: method.country,
        last4: method.last4,
        issuer: method.brand,
        funding: method.funding,
        fingerprint: method.fingerprint,
        expiry: method.exp_month + '/' + method.exp_year,
        updated: Date.now(),
        provider: 'stripe'
    };
}
//# sourceMappingURL=customer.js.map