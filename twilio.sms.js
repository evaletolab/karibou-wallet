
// Download the helper library from https://www.twilio.com/docs/node/install
// Set environment variables for your credentials
// Read more at http://twil.io/secure

// unidirectional
// https://support.twilio.com/hc/en-us/articles/223181348-Alphanumeric-Sender-ID-for-Twilio-Programmable-SMS

//
// bidirectional
// https://console.twilio.com/us1/develop/phone-numbers/manage/search?frameUrl=%2Fconsole%2Fphone-numbers%2Fsearch%3Fx-target-region%3Dus1&currentFrameUrl=%2Fconsole%2Fphone-numbers%2Fsearch%3FisoCountry%3DCH%26searchTerm%3D%26searchFilter%3Dleft%26searchType%3Dnumber%26x-target-region%3Dus1%26__override_layout__%3Dembed%26bifrost%3Dtrue

//
// whatsapp
// https://www.twilio.com/docs/whatsapp/quickstart/node

const accountSid = "ACe52f82c864547add7cce0648e9cdf302";
const authToken = "104ff9c771af75cbf760d7d7f07b09be";
const client = require("twilio")(accountSid, authToken);
client.messages
  .create({ body: "Hello from Twilio", from: "+12707477962", to: "+41763797868" })
    .then(message => console.log(message.sid));