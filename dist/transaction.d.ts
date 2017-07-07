import { Customer } from './customer';
export declare class Transaction {
    private cust;
    private id;
    private amount;
    private groupId;
    private description;
    private authorized;
    private captured;
    private canceled;
    private amountRefunded;
    constructor(cust: Customer, amount: number, groupId: string, description: string);
    static load(params: any): any;
    save(): string;
    auth(): any;
    capture(): any;
    cancel(): void;
    refund(amount?: number): any;
}
export interface Destination {
    account: Account;
    amount: number;
    transferId: string;
}
