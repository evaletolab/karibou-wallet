import Stripe from 'stripe';
export declare enum Payment {
    card = 1,
    sepa = 2,
    balance = 3,
    bitcoin = 4
}
export declare const $stripe: Stripe;
export interface Address {
    id: string;
    name: string;
    note: string;
    floor: string;
    streetAddress: string;
    region: string;
    postalCode: string;
    lat: number;
    lng: number;
}
export declare const parseYear: (year: any) => any;
export declare const normalizeYear: (order: any, year: any) => any;
export declare const readExpiry: (expiryStr: any) => any[];
export declare const dateFromExpiry: (expiryStr: any) => Date;
export declare const xor: (text: string, pkey?: string) => string;
export declare const unxor: (hex: string, pkey?: string) => string;
