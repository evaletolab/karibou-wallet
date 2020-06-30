import { Payment } from './payments.enum';
export declare class Customer {
    private id;
    private sources;
    private map;
    private email;
    private lastname;
    private firstname;
    constructor(json: string);
    static create(email: string, lastname: string, firstname: string): any;
    save(): string;
    addMethod(sourceData: Source, token?: string): any;
    updateMethod(sourceId: string, sourceData: Source): void;
    removeMethod(sourceId: string): any;
    getMethodList(): Promise<any[]>;
    setStripeMethod(sourceId: string): any;
    getChargeList(limit?: number, chargeOffset?: any): any;
    getId(): string;
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
