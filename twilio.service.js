
//
// unidirectional alpha numeric sender,
// https://www.twilio.com/docs/messaging/services/services-send-messages#add-alpha-sender
//
// create a messaging service
// https://www.twilio.com/docs/messaging/services/api

// Download the helper library from https://www.twilio.com/docs/node/install
// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = "ACe52f82c864547add7cce0648e9cdf302";
const authToken = "104ff9c771af75cbf760d7d7f07b09be";
const client = require('twilio')(accountSid, authToken);

//
// current service 
// https://messaging.twilio.com/v1/Services/MG1d0ada01ea54cbf085a57dbb20606540

//
// inboundRequestUrl 
// inboundMethod (GET|POST)
// The URL we call when a message is received by any phone number or short code in the Service
//
// statusCallback
// The URL we call to pass status updates about message delivery.

async function main() {
  const service = await client.messaging.v1.services.create({
     inboundMethod:'POST',
     inboundRequestUrl: 'http://karibou.evaletolab.ch/api/v1/message/inbound',
     statusCallback: 'http://karibou.evaletolab.ch/api/v1/message/status',
     friendlyName: 'James de Karibou.ch'
   });

  console.log('--- DBG service: ', service);
  const SID = service.sid;

  const alpha = await client.messaging.v1.services(SID).alphaSenders.create({alphaSender: 'James de Karibou.ch'})
  console.log('--- DBG alpha service: ', alpha);
  const msg = await client.messages.create({
    body: 'Votre commande est cool',
    messagingServiceSid: SID,
    to: '+41763797868'
  });

  console.log('----- DBG',msg);

}
async function senders() {
  const senders = await client.messaging.v1.services('MG2172dd2db502e20dd981ef0d67850e1a')
                   .alphaSenders.list({limit:10});

  console.log('---- DBG senders',senders.alpha_senders)
                   
}

async function send(){
  const SID = 'MG1d0ada01ea54cbf085a57dbb20606540';

  const msg = await client.messages.create({
    body: 'Votre commande est cool',
    alphaSender:'',
    messagingServiceSid: SID,
    to: '+41763797868'
  });

  console.log('----- DBG',msg);

}


senders();


