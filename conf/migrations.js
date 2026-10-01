// migrate-mongo config for the migrations in ./migrations (run via
// `npx migrate-mongo up -f conf/migrations.js`).
//
// The connection is DERIVED FROM conf/config.json so the CLI targets the SAME
// database the app uses — the centralized DocDB in deployed environments, or a
// local mongo in dev. Previously this url was hardcoded to 127.0.0.1, so the CLI
// never reached DocDB and migrations (e.g. the perf indexes) were never applied.
// config.json is per-environment (gitignored), so each env resolves its own DB.
let config = {};
try {
  config = require('./config.json');
} catch (e) {
  // Fresh checkout before config exists (e.g. `create-migration`): fall back below.
}

let url;
if (config.useConnectionUri && config.dbConnectionUri) {
  // DocDB / any full connection string (carries its own tls/tlsCAFile params).
  url = config.dbConnectionUri;
} else {
  const auth = config.dbUser
    ? encodeURIComponent(config.dbUser) + ':' + encodeURIComponent(config.dbPass || '') + '@'
    : '';
  const port = config.dbPort ? ':' + config.dbPort : '';
  url = 'mongodb://' + auth + (config.dbHost || '127.0.0.1') + port + '/';
  if (config.dbAuthSource) url += '?authSource=' + config.dbAuthSource;
}

module.exports = {
  mongodb: {
    url: url,
    databaseName: config.dbName || 'adapt-tenant-master'
  },
  migrationsDir: "migrations",
  changelogCollectionName: "changelog",
  migrationFileExtension: ".js",
  useFileHash: false
};
