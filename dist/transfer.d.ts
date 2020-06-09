import { Account } from './account';
export interface Destination {
    account: Account;
    amount: number;
    transferId: string;
    amountRefunded: number;
    logs: string[];
}
export declare class Transfer {
    private transaction;
    private dest;
    private constructor(transaction, dest);
    static load(params: any): Transfer;
    save(): string;
    execute(): any;
    refund(account: Account, description: string, amount?: number): any;
    refundAll(description: string): Promise<void | any[]>;
    getState(account: Account): Destination;
}
