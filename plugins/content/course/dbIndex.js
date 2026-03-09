const { MongoClient } = require('mongodb');
const path = require('path');
const fs = require('fs');

// Load configuration from config.json
const configPath = path.join(__dirname, '../../../../conf/config.json');
let config;

try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (error) {
  console.error('Error loading config.json:', error.message);
  throw new Error('Failed to load config.json');
}

let client;
let selectedDbName = config.dbName;

// Build connection URL from config
function buildConnectionUrl() {
  // If useConnectionUri is true and dbConnectionUri is provided, use it directly
  if (config.useConnectionUri && config.dbConnectionUri) {
    return config.dbConnectionUri;
  }
  
  // Otherwise build the URL from individual config values
  const host = config.dbHost;
  const port = config.dbPort || 27017;
  const username = config.dbUser;
  const password = config.dbPass;
  const ssl = config.ssl || false;
  
  return `mongodb://${username}:${password}@${host}:${port}/?ssl=${ssl}&replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false`;
}

async function getDB(queries) {
  try {
    if (!selectedDbName) {
      throw new Error('Database name is required');
    }

    // Build connection URL from config
    const url = buildConnectionUrl();
    
    // Create client with TLS options from config
    const clientOptions = {
      ssl: config.ssl || false,
      tls: config.ssl || false,
      replicaSet: 'rs0',
      readPreference: 'secondaryPreferred',
      retryWrites: false
    };
    
    // Add TLS CA file if configured
    if (config.sslCA) {
      clientOptions.tlsCAFile = config.sslCA;
    }

    client = new MongoClient(url, clientOptions);

    // Use connect method to connect to the server
    await client.connect();
    
    return client.db(selectedDbName);
  } catch (error) {
    console.error('Failed to connect to database:', error.message);
    throw error;
  }
}

function closeDB() {
  if (client) {
    client.close();
  }
}

// Function to set database name programmatically (for scripts that know the DB name)
function setDbName(dbName) {
  selectedDbName = dbName;
}

// Function to get the currently selected database name
function getSelectedDbName() {
  return selectedDbName;
}

module.exports = {
  getDB,
  closeDB,
  setDbName,
  getSelectedDbName,
};
