import { Card, Customer } from './customer';
export interface PaymentOptions {
    oid: string;
    txgroup: string;
    email: string;
    shipping: {
        streetAdress: string;
        postalCode: string;
        name: string;
    };
}
export declare class Transaction {
    private _payment;
    private _refund;
    private _report;
    private constructor();
    get id(): string;
    get oid(): string;
    get paymentId(): string;
    get customer(): string;
    get amount(): number;
    get group(): string;
    get currency(): string;
    get description(): string;
    get requiresAction(): boolean;
    get authorized(): boolean;
    get captured(): boolean;
    get canceled(): boolean;
    get refunded(): number;
    get report(): {
        log: string;
        transaction: string;
        updated: number;
        provider: string;
    };
    static authorize(customer: Customer, card: Card, amount: number, options: PaymentOptions): Promise<Transaction>;
    static get(id: any): Promise<Transaction>;
    static confirm(id: string): Promise<Transaction>;
    capture(amount: number): Promise<this | {
        log: string;
        transaction: string;
        updated: number;
        provider: string;
    }>;
    cancel(): Promise<this>;
    refund(amount?: number): Promise<this>;
}
