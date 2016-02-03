/**
 * # tools
 *
 * Miscellaneous helper functions for boring tasks.
 *
 */

var tools = exports;





/**
 * ## tools.randomString(len, [pool])
 * *Creates a random string of specified length*
 *
 * This function requires Mersenne Twister random number generator implemented
 * in the [node-mersenne package](http://search.npmjs.org/#/mersenne).
 *
 * @param {Number} len Length of the generated string
 * @param {String} [pool] Pool of characters to use for result string
 * @returns {String} Random string
 */
tools.randomString = function(len, pool) {
  var random = require('mersenne');
  var poolLength;
  var output = [];

  pool = pool || 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ012345' +
    '67890!@#$%^&*()_+{}][;"\'/?.,<>';
  poolLength = pool.length;

  for (var i = poolLength; i; --i) {
    output.push(pool[random.rand(poolLength)]);
  }

  return output.join('');
};

/**
 * ## tools.randomHash()
 * *Creates SHA1 hexdigest of a 100-character random string*
 *
 * @returns {String} Random SHA1 hexdigest
 */
tools.randomHash = function(dig) {
  var crypto = require('crypto');
  var hash = crypto.createHash('sha1');
  var rstr = tools.randomString(100);

  hash.update(rstr);

  return hash.digest(dig||'hex');
};

tools.slug = function(str) {
  str = str.
          replace(/^\s+|\s+$/g, '').
          toLowerCase(); // trim/lower
  
  // remove accents, swap ñ for n, etc
  var from = "àáäâèéëêìíïîòóöôùúüûñç·/_,:;";
  var to   = "aaaaeeeeiiiioooouuuunc------";
  for (var i=0, l=from.length ; i<l ; i++) {
    str = str.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i));
  }

  // remove invalid chars
  str = str.replace(/[^a-z0-9 -]/g, '') 
    .replace(/\s+/g, '-') // collapse whitespace and replace by -
    .replace(/-+/g, '-'); // collapse dashes

  return str;
};

tools.stringHash = function(str,dig) {
  var crypto = require('crypto');
  var hash = crypto.createHash('sha1');

  hash.update(str);

  return hash.digest(dig||'hex');
};

// Helper to parse Year
tools.parseYear=function(year) {
  if (!year) { return; }

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
tools.normalizeYear=function (order, year) {
  return (Math.floor(new Date().getFullYear() / order) * order) + year;
}

// Helper for expiry string decode
tools.readExpiry=function (expiryStr) {
  if(expiryStr===undefined)return;
  var expiry=expiryStr.split('/'),
      year=this.parseYear(expiry[1]),month=parseInt(expiry[0]);


  // not a good date
  if(isNaN(month)||year===undefined||year>2050||year<2000||month<1||month>12){
    return;
  }
  return [year,month];
}


tools.dateFromExpiry=function (expiryStr) {
  var expiry=this.readExpiry(expiryStr);
  if(expiry&&expiry.length){
    return new Date(expiry[0], expiry[1],0,23,59,0,0);
  }
}


