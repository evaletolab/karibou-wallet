import Config from './config';
import Stripe from 'stripe';
import { createHash, randomBytes } from 'crypto';



export enum KngPayment {
  card = 1,
  sepa,
  balance,
  credit,
  bitcoin  
};

export enum KngPaymentIssuer {
 "american express" = "american express",
	visa = "visa",
	mastercard = "mastercard",
	mc = "mc",
	paypal = "paypal",
	invoice = "invoice",
	cash = "cash",
	balance = "balance",
	bitcoin = "bitcoin",
	amex = "amex"	
};



export type KngPaymentStatus = "pending"
													| "authorized"
													| "partially_paid"
													| "invoice"
													| "invoice_paid"
													| "paid"
													| "partially_refunded"
													| "refunded"
													| "voided";

export type KngPaymentExendedStatus = "refunded" | "prepaid" | "invoice";

//
// when importing a transaction, the context can be on Stripe or on Karibou database
export interface KngOrderPayment {	
	transaction: string;	
	alias: string;
	issuer: string;
	status: KngPaymentStatus;
	handle?: string;
	provider: string;
	hub_refund: number;
	logs: [string];
	fees:{
		charge:number;
		shipping:number;
	}
	number?: string;
	expiry?: string;	
}

export interface KngPaymentInvoice {
  id: string;
  metadata:{
    order:string;
		customer_credit?:string;
		exended_status?:KngPaymentExendedStatus;
		refund:string;
  }
  status: string;
  client_secret: string;
  payment_method:"invoice";
  customer: string;
  amount_received?:number;
  amount:number;
  transfer_group?:string;
  currency:string;
  description:string;
}

export interface KngPaymentAddress {
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

export interface KngPaymentSource {
  type:KngPayment;
  id:string;
	alias:string;
	issuer:string;
}

export interface KngCard extends KngPaymentSource {
  country:string;
  last4:string;
  issuer:string;
  funding:string;
  fingerprint:string;
  expiry:string;
  brand:string;
}


export interface CashBalance extends KngPaymentSource {
  issuer:"cash";
  funding:string;
  expiry:string;
}

export interface CreditBalance extends KngPaymentSource {
  issuer:"invoice";
  funding:string;
  expiry:string;
	limit:number;
}



export const $stripe = new Stripe(Config.option('stripePrivatekey'), {
  apiVersion: Config.option('stripeApiVersion'),
  maxNetworkRetries: 2
});


export const round5cts=function (value) {
	return parseFloat((Math.round(value*20)/20).toFixed(2))
}

export const round1cts=function (value) {
	return parseFloat((Math.round(value*100)/100).toFixed(2))
}


// Helper to parse Year
// FIXME Payments.parseYear must be tested
export const parseYear = function(year) {
  if (!year) { return; }
  let yearVal;
  year = parseInt(year, 10);
  if (year < 10) {
    yearVal = normalizeYear(10, year);
  } else if (year >= 10 && year < 100) {
    yearVal = normalizeYear(100, year)-2000;
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
      year=parseYear(expiry[1]),month=parseInt(expiry[0]);


  // not a good date
  if(isNaN(month)||year===undefined||year>2050||year<2000||month<1||month>12){
    return;
  }
  return [year,month];
}


export const dateFromExpiry = function (expiryStr) {
  var expiry=readExpiry(expiryStr);
  if(expiry&&expiry.length){
    return new Date(expiry[0], expiry[1],0,23,59,0,0);
  }
}

//
// simple XOR encryption
export const xor = function(text:string, pkey?:string) :string {
  pkey = pkey || Config.option('shaSecret');

	//
	// check if text is hex content
	const ishex = /[0-9A-Fa-f]{0,*}/g;

	//ishex.test(text);

	//
	// create buffer from source string or hex
  const data = (ishex.test(text))?
		Uint8Array.from(text.match(/.{1,2}/g).map((byte) => parseInt(byte, 16))):
		Uint8Array.from(Array.from(text).map(char => char.charCodeAt(0)));
  const key = Uint8Array.from(Array.from(pkey).map(char => char.charCodeAt(0)));


  // encoding are hex,base64,ascii, utf8
  const uint8 =  data.map((digit, i) => {
    return (digit ^ keyNumberAt(key, i));
  });

  return Buffer.from(uint8).toString('hex');
}

export const unxor = function(hex:string, pkey?:string) :string {   
  pkey = pkey || Config.option('shaSecret');
	hex = (typeof hex == 'string')? hex: "00";
  const data = Uint8Array.from(hex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
  const key = Uint8Array.from(Array.from(pkey).map(char => char.charCodeAt(0)));
  const uint8 = data.map((digit, i) => {
    return ( digit ^ keyNumberAt(key, i) );
  });
	const encoding = uint8.some(char => char >=127) ? 'hex':'ascii';
  return Buffer.from(uint8).toString(encoding);
}

//
// WARNING: use array of uint8 to encode sha256 with xor
export const crypto_fingerprint = function(input) {
	const hash=(crypto_sha256(input,'hex'));
	return xor(hash);
}

export const crypto_randomToken = function() {
	const hex = randomBytes(16).toString('hex');
	return hex;
}

export const crypto_sha256 = function(input:string,output) {
	return createHash('sha256').update(input).digest(output);
}

//
// stripe error
export function stripeParseError(err) {
	//
	// err.code
	const errorMessages = {
	  incorrect_number: "Le numéro de carte est incorrect.",
	  invalid_number: "Le numéro de carte n'est pas compatible avec le format 'credit card'.",
	  invalid_expiry_month: "Le mois d'expiration de votre carte n'est plus valide.",
	  invalid_expiry_year: "L'année d'expiration de votre carte n'est plus valide.",
	  invalid_cvc: "Le code de sécurité de votre carte (CVC) est invalide.",
	  expired_card: "Votre carte a expiré",
	  incorrect_cvc: "Le code de sécurité de la carte est incorrect.",
	  incorrect_zip: "The card's zip code failed validation.",
	  card_declined: "La carte a été refusée.",
	  missing: "There is no card on a customer that is being charged.",
	  processing_error: "An error occurred while processing the card.",
	  rate_limit:  "An error occurred due to requests hitting the API too quickly. Please let us know if you're consistently running into this error."
	};

	//
	// err.decline_code
	// https://stripe.com/docs/error-codes
	const declineMessage={
		approve_with_id : "The payment cannot be authorized",
    authentication_required: "The card requires code confirmation",
		call_issuer : "The card has been declined :-( Please contact your bank for more information",
		card_not_supported : "The card does not support this type of purchase",
		card_velocity_exceeded : "The customer has exceeded the balance or credit limit available on their card",
		currency_not_supported : "The card does not support the specified currency",
		do_not_honor : "The card has been declined :-( Please contact your bank for more information.",
		do_not_try_again : "Please note, for security reasons the bank may block your card temporarily",
		duplicate_transaction : "A transaction with identical amount and credit card information was submitted very recently",
		expired_card : "La carte a expiré",
		fraudulent : "The payment has been declined as Stripe suspects it is fraudulent",
		generic_decline : "The card has been declined for an unknown reason",
		incorrect_number : "The card number is incorrect",
		incorrect_cvc : "The CVC number is incorrect",
		incorrect_pin : "The PIN entered is incorrect. This decline code only applies to payments made with a card reader",
		incorrect_zip : "The ZIP/postal code is incorrect",
		insufficient_funds : "The card has insufficient funds to complete the purchase",
		invalid_account : "The card, or account the card is connected to, is invalid",
		invalid_amount : "The payment amount is invalid, or exceeds the amount that is allowed",
		invalid_cvc : "The CVC number is not valid",
		invalid_expiry_year : "The expiration year invalid",
		invalid_number : "The card number is incorrect",
		invalid_pin : "The PIN entered is incorrect. This decline code only applies to payments made with a card reader",
		issuer_not_available : "The card issuer could not be reached, so the payment could not be authorized",
		lost_card : "The payment has been declined because the card is reported lost",
		new_account_information_available : "The card, or account the card is connected to, is invalid",
		no_action_taken : "The card has been declined for an unknown reason",
		not_permitted : "The payment is not permitted",
		pickup_card : "The card cannot be used to make this payment (it is possible it has been reported lost or stolen)",
		pin_try_exceeded : "The allowable number of PIN tries has been exceeded",
		processing_error : "An error occurred while processing the card",
		reenter_transaction : "The payment could not be processed by the issuer for an unknown reason",
		restricted_card : "The card cannot be used to make this payment (it is possible it has been reported lost or stolen)",
		revocation_of_all_authorizations : "The card has been declined for an unknown reason",
		revocation_of_authorization : "The card has been declined for an unknown reason",
		security_violation : "The card has been declined for an unknown reason",
		service_not_allowed : "The card has been declined for an unknown reason",
		stolen_card : "The payment has been declined because the card is reported stolen",
		stop_payment_order : "The card has been declined for an unknown reason",
		testmode_decline : "A Stripe test card number was used",
		transaction_not_allowed : "The card has been declined for an unknown reason",
		try_again_later : "The card has been declined for an unknown reason",
		withdrawal_count_limit_exceeded : "The customer has exceeded the balance or credit limit available on their card"
	};

	const declineMessage_fr={
		approve_with_id : "The payment cannot be authorized",
		call_issuer : "La banque a refusée votre carte pour une raison inconnue",
		card_not_supported : "The card does not support this type of purchase",
		card_velocity_exceeded : "The customer has exceeded the balance or credit limit available on their card",
		currency_not_supported : "The card does not support the specified currency",
		do_not_honor : "La carte a été refusée :-(. Veuillez contacter votre banque pour plus d'informations.",
		do_not_try_again : "Attention, pour des raisons de sécurité la banque peut bloquer votre carte temporairement",
		duplicate_transaction : "A transaction with identical amount and credit card information was submitted very recently",
		expired_card : "The card has expired",
		fraudulent : "The payment has been declined as Stripe suspects it is fraudulent",
		generic_decline : "La banque a refusée votre carte pour une raison inconnue",
		incorrect_number : "The card number is incorrect",
		incorrect_cvc : "Le numéro CVC est incorrect",
		incorrect_pin : "The PIN entered is incorrect. This decline code only applies to payments made with a card reader",
		incorrect_zip : "The ZIP/postal code is incorrect",
		insufficient_funds : "La carte ne dispose pas de fonds suffisants pour effectuer un achat",
		invalid_account : "The card, or account the card is connected to, is invalid",
		invalid_amount : "The payment amount is invalid, or exceeds the amount that is allowed",
		invalid_cvc : "Le numéro CVC n'est pas valide",
		invalid_expiry_year : "The expiration year invalid",
		invalid_number : "The card number is incorrect",
		invalid_pin : "The PIN entered is incorrect. This decline code only applies to payments made with a card reader",
		issuer_not_available : "The card issuer could not be reached, so the payment could not be authorized",
		lost_card : "Le paiement a été refusé car la carte est déclarée perdue",
		new_account_information_available : "The card, or account the card is connected to, is invalid",
		no_action_taken : "The card has been declined for an unknown reason",
		not_permitted : "The payment is not permitted",
		pickup_card : "The card cannot be used to make this payment (it is possible it has been reported lost or stolen)",
		pin_try_exceeded : "The allowable number of PIN tries has been exceeded",
		processing_error : "An error occurred while processing the card",
		reenter_transaction : "The payment could not be processed by the issuer for an unknown reason",
		restricted_card : "The card cannot be used to make this payment (it is possible it has been reported lost or stolen)",
		revocation_of_all_authorizations : "The card has been declined for an unknown reason",
		revocation_of_authorization : "The card has been declined for an unknown reason",
		security_violation : "The card has been declined for an unknown reason",
		service_not_allowed : "The card has been declined for an unknown reason",
		stolen_card : "The payment has been declined because the card is reported stolen",
		stop_payment_order : "The card has been declined for an unknown reason",
		testmode_decline : "A Stripe test card number was used",
		transaction_not_allowed : "The card has been declined for an unknown reason",
		try_again_later : "The card has been declined for an unknown reason",
		withdrawal_count_limit_exceeded : "The customer has exceeded the balance or credit limit available on their card"
	};

	// console.log('---DBG error code',err.type,err.decline_code)
	switch (err.type) {
	  case 'StripeCardError':
			// A declined card error
			const msg=declineMessage_fr[err.decline_code]||
                errorMessages[err.code]||
                err.message;
	    return new Error(msg);
	  case 'StripeInvalidRequestError':
	    // Invalid parameters were supplied to Stripe's API
	    break;
	  case 'StripeAPIError':
	    // An error occurred internally with Stripe's API
	    break;
	  case 'StripeConnectionError':
	    // Some kind of error occurred during the HTTPS communication
	    break;
	  case 'StripeAuthenticationError':
	    // You probably used an incorrect API key
	    break;
	}	
	return err
}

//
// export instances variables

export const card_mastercard_prepaid = {
	type:KngPayment.card,
	issuer:'visa',
	alias: xor('pm_card_visa'),
	id: xor('pm_card_mastercard_prepaid')
} as KngCard;

export const card_authenticationRequired = {
	type:KngPayment.card,
	issuer:'visa',
	alias: xor('pm_card_visa'),
	id: xor('pm_card_authenticationRequired')
} as KngCard;

export const card_visa_chargeDeclined = {
	type:KngPayment.card,
	issuer:'visa',
	alias: xor('pm_card_visa'),
	id: xor('pm_card_visa_chargeDeclined')
} as KngCard;

export const card_visa_chargeDeclinedLostCard = {
	type:KngPayment.card,
	issuer:'visa',
	alias: xor('pm_card_visa'),
	id: xor('pm_card_visa_chargeDeclinedLostCard')
} as KngCard;

export const card_chargeDeclinedProcessingError = {
	type:KngPayment.card,
	issuer:'visa',
	alias: xor('pm_card_visa'),
	id: xor('pm_card_chargeDeclinedProcessingError')
} as KngCard;

export const default_card_invoice = {
	type:KngPayment.credit,
	issuer:'invoice',
	alias: xor('pm_card_visa'),
	id: xor('pm_card_invoice')
} as KngCard;

//
// private functions


function keyNumberAt(key:Uint8Array, i:number) {
  return key[Math.floor(i % key.length)];
}
