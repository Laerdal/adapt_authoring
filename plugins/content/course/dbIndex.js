const { MongoClient } = require('mongodb');
const configuration = require('../../../lib/configuration');

let client;
let selectedDbName;

// Build connection URL from config (called at runtime, not require time)
function buildConnectionUrl() {
  // If useConnectionUri is true and dbConnectionUri is provided, use it directly
  const useConnectionUri = configuration.getConfig('useConnectionUri');
  const dbConnectionUri = configuration.getConfig('dbConnectionUri');
  
  if (useConnectionUri && dbConnectionUri) {
    return dbConnectionUri;
  }
  
  // Otherwise build the URL from individual config values
  const host = configuration.getConfig('dbHost');
  const port = configuration.getConfig('dbPort') || 27017;
  const username = configuration.getConfig('dbUser');
  const password = configuration.getConfig('dbPass');
  const ssl = configuration.getConfig('ssl') || false;
  
  return `mongodb://${username}:${password}@${host}:${port}/?ssl=${ssl}&replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false`;
}

async function getDB(queries) {
  try {
    // Get database name from config if not already set
    if (!selectedDbName) {
      selectedDbName = configuration.getConfig('dbName');
    }
    
    if (!selectedDbName) {
      throw new Error('Database name is required');
    }

    // Build connection URL from config
    const url = buildConnectionUrl();
    
    // Create client with TLS options from config
    const ssl = configuration.getConfig('ssl') || false;
    const clientOptions = {
      ssl: ssl,
      tls: ssl,
      replicaSet: 'rs0',
      readPreference: 'secondaryPreferred',
      retryWrites: false
    };
    
    // Add TLS CA file if configured
    const sslCA = configuration.getConfig('sslCA');
    if (sslCA) {
      clientOptions.tlsCAFile = sslCA;
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
