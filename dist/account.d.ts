export declare class Account {
    private id;
    private email;
    private lastname;
    private firstname;
    private address;
    private postalCode;
    private city;
    private company;
    private constructor(params);
    static create(id: string): any;
    save(): string;
    getTransferList(limit?: number, transferOffset?: any): any;
}
