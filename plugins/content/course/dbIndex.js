const { MongoClient } = require('mongodb');
const path = require('path');
const fs = require('fs');

let client;
let selectedDbName;
let cachedConfig = null;

// Function to load configuration from config.json
function loadConfig() {
  if (cachedConfig) {
    return cachedConfig;
  }
  try {
    const configPath = path.join(__dirname, '../../../conf/config.json');
    cachedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return cachedConfig;
  } catch (error) {
    console.error('Error loading config.json:', error.message);
    throw new Error('Failed to load config.json');
  }
}

// Build connection URL from config
function buildConnectionUrl(config) {
  // If useConnectionUri is true and dbConnectionUri is provided, use it directly
  if (config.useConnectionUri && config.dbConnectionUri) {
    return config.dbConnectionUri;
  }

  // Otherwise build the URL from individual config values
  const host = config.dbHost;
  const port = config.dbPort || 27017;
  const username = config.dbUser;
  const password = config.dbPass;

  // Build URL with proper query params for DocumentDB/MongoDB
  return `mongodb://${username}:${password}@${host}:${port}/?ssl=true&replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false`;
}

async function getDB(queries) {
  try {
    const config = loadConfig();

    // Load database name from config if not already selected
    if (!selectedDbName) {
      selectedDbName = config.dbName;
      if (!selectedDbName) {
        throw new Error('Database name is required');
      }
    }

    // Build connection URL from config
    const url = buildConnectionUrl(config);

    // Create client with TLS options - required for AWS DocumentDB
    const clientOptions = {
      tls: true,
      replicaSet: 'rs0',
      readPreference: 'secondaryPreferred',
      retryWrites: false
    };

    // TLS CA file is REQUIRED for DocumentDB connection
    if (config.sslCA) {
      clientOptions.tlsCAFile = config.sslCA;
      console.log(`Using TLS CA file: ${config.sslCA}`);
    } else {
      console.warn('Warning: sslCA not configured - DocumentDB connection may fail');
    }

    client = new MongoClient(url, clientOptions);

    // Use connect method to connect to the server
    await client.connect();
    console.log('Connected successfully to MongoDB server');
    console.log(`Using database: ${selectedDbName}`);

    return client.db(selectedDbName);
  } catch (error) {
    console.error('Failed to connect to database:', error.message);
    throw error;
  }
}

function closeDB() {
  if (client) {
    client.close();
    console.log('Connection closed.');
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
