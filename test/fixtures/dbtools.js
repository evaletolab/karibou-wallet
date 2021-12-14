
var db    = require("mongoose");
var fx    = require('pow-mongoose-fixtures');

db.Promise = Promise;  

exports.clean=async function(callback){
  if (process.env.NODE_ENV!=='test'){
    console.log('cannot run test without test environement: NODE_ENV=test mocha')
    process.exit(1);
  }

  const collections = Object.keys(db.connection.collections);
  for (let collection in collections) {
    if (!collection.match(/^system\./)){
      await db.connection.collections[collection].drop();      
    }
  }
  callback();
};

exports.fixtures=function(names){
  if (process.env.NODE_ENV!=='test'){
    console.log('cannot run test without test environement: NODE_ENV=test mocha')
    process.exit(1);
  }
    
  var data={};
  names.forEach(function(name) {
    var fx=require('../fixtures/'+name);
    Object.keys(fx).forEach(function(model){
      data[model]=fx[model];
    });
  });
  return data;
}
exports.load=async function(fixtures, cb, callback){
  if (process.env.NODE_ENV!=='test'){
    console.log('cannot run test without test environement: NODE_ENV=test mocha')
    process.exit(1);
  }

  for (let fixture in fixtures) {
    await fx.load(fixture,db);
  }
  callback();
}


