module.exports =  {
  "customer": "cus_NmMLTILgAb9LpE",
  "payment_behavior": "allow_incomplete",
  "default_payment_method": "pm_1N0ncvBTMLb4og7PFVJcdiQu",
  "off_session": true,
  "description": "Contrat de souscription: month",
  "billing_cycle_anchor": "2023-05-02T15:17:56.571Z",
  "items": [
    {
      "metadata": {
        "dayOfWeek": 2,
        "sku": 1000014,
        "title": "Test 2",
        "quantity": 2,
        "part": "0.5g",
        "hub": "mocha",
        "note": "+bouchon",
        "fees": 0.06
      },
      "price_data": {
        "currency": "CHF",
        "unit_amount": 5000,
        "product": "prod_NmMDNHaaH3FrDR",
        "recurring": {
          "interval": "month",
          "interval_count": 1
        }
      }
    }
  ],
  "metadata": {
    "address": "{\"streetAdress\":\"rue du rhone 69\",\"postalCode\":\"1208\",\"name\":\"foo bar family\",\"fees\":5}"
  }
}
