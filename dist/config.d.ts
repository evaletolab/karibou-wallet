export declare class Config {
    private stripeVersion;
    private isConfigured;
    private debug;
    private allowMaxAmount;
    private sandbox;
    private publickey;
    private privatekey;
    private apikey;
    private secret;
    private currency;
    private allowedCurrencies;
    private allowMultipleSetOption;
    private static settings;
    private constructor();
    static reset(): void;
    static debug(message: string): void;
    static configure(opts: any): void;
    static option(option: any, value: any): any;
}
