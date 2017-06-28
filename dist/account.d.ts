export declare class Account {
    private stripeAccid;
    private email;
    private lastname;
    private firstname;
    private address;
    private postalCode;
    private city;
    private company;
    private constructor(json);
    static create(stripeAccid: string): any;
    save(): string;
    getTransferList(limit?: number, transferOffset?: any): any;
}
