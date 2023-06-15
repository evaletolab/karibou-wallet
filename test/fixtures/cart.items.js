module.exports = [
  {
    frequency:0,
    // email?:string;
    timestamp: Date.now(),
    hub: 'mocha',
    sku: 1000012,
    title: "Test 0",
    quantity: 2,
    part: "0.75L",
    note: "+bouchon",
    price: 7,
    finalprice: 7.6,
  },
  {
    frequency:2, // week;
    timestamp: Date.now(),
    hub: 'mocha',
    sku: 1000013,
    title: "Petit panier de légumes",
    quantity: 2,
    part: "0.75L",
    note: "",
    price: 7,
    finalprice: 14.5,
  },
  {
    frequency:2, // week;
    timestamp: Date.now(),
    hub: 'mocha',
    sku: 1000014,
    title: "Bouquet de la semaine",
    quantity: 2,
    part: "0.00075L",
    note: "-bouchon",
    price: 7,
    finalprice: 14.5,
  },
  {
    frequency:4, // month;
    timestamp: Date.now(),
    hub: 'mocha',
    sku: 1000014,
    title: "Grand panier de Bonbons",
    quantity: 2,
    part: "0.5g",
    note: "+bouchon",
    price: 7,
    finalprice: 50,
  }
]