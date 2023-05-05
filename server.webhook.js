// install stripe cli => https://stripe.com/docs/stripe-cli#install
// grant access https://dashboard.stripe.com/stripecli/confirm_auth?t=
// node server.webhook.js
// stripe login
// stripe listen --forward-to localhost:4242/webhook
// stripe trigger invoice.payment_succeeded

 

// This is a public sample test API key.
// Don’t submit any personally identifiable information in requests made with this key.
// Sign in to see your own test API key embedded in code samples.
const config = require('./dist/config').default;
const Webhook = require('./dist/webhook').default;

const stripe = require('stripe')(config.option('stripePrivatekey'));
// Replace this endpoint secret with your endpoint's unique secret
// If you are testing with the CLI, find the secret by running 'stripe listen'
// If you are using an endpoint defined with the API or dashboard, look in your webhook settings
// at https://dashboard.stripe.com/webhooks
const express = require('express');
const app = express();


app.post('/webhook', express.raw({type: 'application/json'}), async (request, response) => {
  // Only verify the event if you have an endpoint secret defined.
  // Otherwise use the basic event deserialized with JSON.parse
  const signature = request.headers['stripe-signature'];

  const result = await Webhook.parse(request.body,signature);
  console.log('---------- webhook',result)


  // Return a 200 response to acknowledge receipt of the event
  response.send();
});

app.listen(4242, () => console.log('Running on port 4242'));