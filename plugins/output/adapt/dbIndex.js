const { MongoClient } = require('mongodb');

// Connection URL
const url = 'mongodb://localhost:27017';
const client = new MongoClient(url);

// Database Name
const dbName = 'adapt-tenant-master';

async function getDB(queries) {
  // Use connect method to connect to the server
  await client.connect();
  console.log('Connected successfully to server');
  return client.db(dbName);
}

function closeDB() {
  client.close();
  console.log('Connection closed.');
}

module.exports = {
  getDB,
  closeDB,
};
