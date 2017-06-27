import { Payment } from './payments.enum';
export declare class Customer {
    private stripeCusid;
    private sources;
    private map;
    private email;
    private lastname;
    private firstname;
    constructor(json: string);
    static create(email: string, lastname: string, firstname: string): any;
    save(): string;
    addPayment(sourceData: Source, token?: string): any;
    updatePayment(sourceId: string, sourceData: Source): void;
    removePayment(sourceId: string): any;
    getPaymentList(): Promise<any[]>;
    setStripePayment(sourceId: string): any;
    getChargeList(limit?: number, chargeOffset?: any): any;
}
export interface Source {
    type: Payment;
    sourceId: string;
    owner: string;
}
export interface Card extends Source {
    last4: string;
    exp_month: number;
    exp_year: number;
    brand: string;
}
