import Config from './config';
import Stripe from 'stripe';

export enum Payment {
  card = 1,
  sepa,
  balance,
  bitcoin  
}


export const $stripe = new Stripe(Config.option('stripePrivatekey'), {
  apiVersion: Config.option('stripeApiVersion'),
  maxNetworkRetries: 2
});

export interface Address {
  id:string;
  name:string;
  note:string;
  floor:string;
  streetAddress:string;
  region:string;
  postalCode:string;  
  lat:number;
  lng:number;
}


// Helper to parse Year
export const parseYear = function(year) {
  if (!year) { return; }
  let yearVal;
  year = parseInt(year, 10);
  if (year < 10) {
    yearVal = this.normalizeYear(10, year);
  } else if (year >= 10 && year < 100) {
    yearVal = this.normalizeYear(100, year)-2000;
  } else if (year >= 2000 && year < 2050){
    yearVal = parseInt(year)-2000;
  } else {
    yearVal = year;
  }
  return yearVal+2000;
}

// Helper for year normalization
export const normalizeYear = function (order, year) {
  return (Math.floor(new Date().getFullYear() / order) * order) + year;
}

// Helper for expiry string decode
export const readExpiry=function (expiryStr) {
  if(expiryStr===undefined)return;
  var expiry=expiryStr.split('/'),
      year=this.parseYear(expiry[1]),month=parseInt(expiry[0]);


  // not a good date
  if(isNaN(month)||year===undefined||year>2050||year<2000||month<1||month>12){
    return;
  }
  return [year,month];
}


export const dateFromExpiry = function (expiryStr) {
  var expiry=this.readExpiry(expiryStr);
  if(expiry&&expiry.length){
    return new Date(expiry[0], expiry[1],0,23,59,0,0);
  }
}

//
// simple XOR encryption

export const xor = function(text:string, pkey?:string) :string {
  pkey = pkey || Config.option('shaSecret');
  const data = Uint8Array.from(Array.from(text).map(char => char.charCodeAt(0)));
  const key = Uint8Array.from(Array.from(pkey).map(char => char.charCodeAt(0)));

  // encoding are hex,base64,ascii, utf8
  const uint8 =  data.map((digit, i) => {
    return (digit ^ keyNumberAt(key, i));
  });
  return Buffer.from(uint8).toString('hex');
}

export const unxor = function(hex:string, pkey?:string) :string {   
  pkey = pkey || Config.option('shaSecret');
  const text = Buffer.from(hex, 'hex').toString();
  const data = Uint8Array.from(Array.from(text).map(char => char.charCodeAt(0)));
  const key = Uint8Array.from(Array.from(pkey).map(char => char.charCodeAt(0)));
  const uint8 = data.map((digit, i) => {
    return ( digit ^ keyNumberAt(key, i) );
  });
  return Buffer.from(uint8).toString();
}

//
// private functions


function keyNumberAt(key:Uint8Array, i:number) {
  return key[Math.floor(i % key.length)];
}
