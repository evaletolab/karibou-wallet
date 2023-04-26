import Stripe from 'stripe';
import { Payment, Address } from './payments';
export interface Source {
    type: Payment;
    id: string;
}
export interface Card extends Source {
    alias: string;
    country: string;
    last4: string;
    issuer: string;
    funding: string;
    fingerprint: string;
    expiry: string;
    brand: string;
}
export declare class Customer {
    private _available;
    private _sources;
    private _id;
    private _metadata;
    private _email;
    private _phone;
    private _fname;
    private _lname;
    private _uid;
    private _addresses;
    private constructor();
    get id(): string;
    get email(): string;
    get phone(): string;
    get name(): {
        familyName: string;
        givenName: string;
    };
    get uid(): string;
    get addresses(): Address[];
    get methods(): any;
    static create(email: string, fname: string, lname: string, phone: string, uid: string): Promise<Customer>;
    static get(id: any): Promise<Customer>;
    addressAdd(address: Address): Promise<void>;
    addressRemove(address: Address): Promise<void>;
    addressUpdate(address: Address): Promise<void>;
    addMethodIntent(): Promise<Stripe.Response<Stripe.SetupIntent>>;
    addMethod(token: string): Promise<{
        id: string;
        alias: string;
        country: any;
        last4: any;
        issuer: any;
        funding: any;
        fingerprint: any;
        expiry: string;
        updated: number;
        provider: string;
    }>;
    removeMethod(method: Card): Promise<void>;
    listMethods(): Promise<any>;
    findMethodByAlias(alias: any): any;
}
