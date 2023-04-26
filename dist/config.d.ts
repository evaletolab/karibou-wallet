export default class Config {
    private stripeApiVersion;
    private stripePrivatekey;
    private debug;
    private allowMaxAmount;
    private sandbox;
    private apikey;
    private secret;
    private currency;
    private allowedCurrencies;
    private allowMultipleSetOption;
    private static settings;
    private constructor();
    static reset(): void;
    static configure(opts: any): any;
    static option(option: string, value?: any): any;
}
export declare const $config: any;
