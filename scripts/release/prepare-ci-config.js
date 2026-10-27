// Writes conf/config.json for a CI build: just enough for `npm ci` (postinstall -> installPlugins.js)
// and `grunt build:prod`. Plugin paths point into the checked-out adapt-authoring-plugins repo.
// Usage: node scripts/release/prepare-ci-config.js <path-to-adapt-authoring-plugins>
const fs = require('fs');
const path = require('path');

const pluginsRepo = path.resolve(process.argv[2] || '');
if (!process.argv[2] || !fs.existsSync(pluginsRepo)) {
  console.error('usage: prepare-ci-config.js <path-to-adapt-authoring-plugins>');
  process.exit(1);
}

const manifest = require('./plugins.manifest.json');
const plugins = {};
for (const [name, p] of Object.entries(manifest)) {
  const entry = { isEnabled: true, frontend: null, backend: null };
  for (const kind of ['frontend', 'backend']) {
    if (!p[kind]) continue;
    const dir = path.join(pluginsRepo, p[kind]);
    if (!fs.existsSync(dir)) {
      console.error(`${name}: ${kind} path missing in plugins repo: ${p[kind]}`);
      process.exit(1);
    }
    entry[kind] = kind === 'frontend' ? { path: dir } : { path: dir, dest: p.dest };
  }
  plugins[name] = entry;
}

const config = {
  dbType: 'mongoose',
  dbHost: 'localhost',
  dbPort: 27017,
  dbName: 'adapt-ci',
  serverPort: 5000,
  serverName: 'localhost',
  masterTenantName: 'master',
  isProduction: true,
  plugins
};

fs.mkdirSync('conf', { recursive: true });
fs.writeFileSync(path.join('conf', 'config.json'), JSON.stringify(config, null, 2));
console.log(`conf/config.json written with ${Object.keys(plugins).length} plugins`);
