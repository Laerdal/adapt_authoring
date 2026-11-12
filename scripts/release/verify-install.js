#!/usr/bin/env node
// Post-deploy check, run ON the instance by deploy-release.sh after the framework-plugins import.
// Read-only. Proves every plugin in the framework-plugins clone ended up fully installed:
//   1. folder in the framework      temp/<tenant>/adapt_framework/src/<folder>/<name>/bower.json  (same version)
//   2. copy used for publishing     plugins/content/<type>/versions/<name>/<version>/<name>/bower.json
//   3. exactly one database row     <type>types  { name, version }
// A plugin with a DB row but no folder is what broke previews on SD (Oct 2026): this fails the deploy instead.
// Usage: node scripts/release/verify-install.js [--app <dir>]      exit 0 = ok, 1 = problems (listed), 2 = could not check
const fs = require('fs');
const path = require('path');

// plugin type -> folder name in the framework-plugins repo AND in the framework's src/ (same as webhooks helpers.js)
const TYPES = [
  { type: 'component', folder: 'components' },
  { type: 'extension', folder: 'extensions' },
  { type: 'menu', folder: 'menu' },
  { type: 'theme', folder: 'theme' }
];

function readVersion(bowerPath) {
  try { return String(JSON.parse(fs.readFileSync(bowerPath, 'utf8')).version || '').trim() || null; } catch (e) { return null; }
}

// What the framework-plugins clone says should be installed: [{ type, folder, name, version }] plus unreadable ones.
function readExpected(cloneDir) {
  const expected = [];
  const problems = [];
  TYPES.forEach(({ type, folder }) => {
    const dir = path.join(cloneDir, folder);
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory()).forEach(e => {
      try {
        const bower = JSON.parse(fs.readFileSync(path.join(dir, e.name, 'bower.json'), 'utf8'));
        expected.push({ type, folder, name: bower.name, version: String(bower.version).trim() });
      } catch (err) {
        // e.g. a git submodule that was not checked out: the import itself would have crashed on it
        problems.push(`${type} ${e.name}: bower.json unreadable in the clone (${err.code || err.message})`);
      }
    });
  });
  return { expected, problems };
}

// Pure: compares expectations with what the instance has. probes = { srcVersion(p), hasVersionCopy(p), dbRows(p) }.
function findProblems(expected, probes) {
  const problems = [];
  expected.forEach(p => {
    const tag = `${p.type} ${p.name}@${p.version}`;
    const src = probes.srcVersion(p);
    if (src === null) problems.push(`${tag}: folder missing in framework src/${p.folder}`);
    else if (src !== p.version) problems.push(`${tag}: framework src/${p.folder} has ${src}`);
    if (!probes.hasVersionCopy(p)) problems.push(`${tag}: no copy under plugins/content/${p.type}/versions`);
    const rows = probes.dbRows(p);
    if (rows.length === 0) problems.push(`${tag}: no database row`);
    else if (rows.length > 1) problems.push(`${tag}: ${rows.length} database rows (${rows.map(r => r.version).join(', ')})`);
    else if (String(rows[0].version).trim() !== p.version) problems.push(`${tag}: database has ${rows[0].version}`);
  });
  return problems;
}

// Same connection rules as lib/dml/mongoose/index.js (dbConnectionUri, or host/port/user/pass; dbOptions for TLS).
function connectionString(cfg) {
  if (cfg.dbConnectionUri) {
    const uri = require('mongodb-uri');
    const parsed = uri.parse(cfg.dbConnectionUri);
    parsed.database = cfg.dbName;
    return uri.format(parsed);
  }
  const auth = cfg.dbUser && cfg.dbPass ? `${cfg.dbUser}:${cfg.dbPass}@` : '';
  const authSource = cfg.dbAuthSource ? `?authSource=${cfg.dbAuthSource}` : '';
  return `mongodb://${auth}${cfg.dbHost}${cfg.dbPort ? ':' + cfg.dbPort : ''}/${cfg.dbName}${authSource}`;
}

async function main() {
  const i = process.argv.indexOf('--app');
  const app = path.resolve(i > -1 ? process.argv[i + 1] : process.cwd());
  const cfg = require(path.join(app, 'conf', 'config.json'));
  const hooks = (cfg.plugins || {})['adapt-devtools-webhooks'] || {};
  const clone = (hooks.frameworkPlugins || {}).repoPath || path.join(app, 'repos', 'adapt-framework-plugins');
  const fwSrc = path.join(app, 'temp', cfg.masterTenantID, 'adapt_framework', 'src');

  const { expected, problems: unreadable } = readExpected(clone);
  if (!expected.length) { console.error(`[verify] no plugins found in ${clone}`); return 2; }

  const mongoose = require('mongoose');
  const conn = await mongoose.createConnection(connectionString(cfg), Object.assign({}, cfg.dbOptions, { useNewUrlParser: true, useUnifiedTopology: true }));
  try {
    const rowsByType = {};
    for (const { type } of TYPES) {
      rowsByType[type] = await conn.db.collection(`${type}types`).find({}).project({ name: 1, version: 1 }).toArray();
    }
    const problems = unreadable.concat(findProblems(expected, {
      srcVersion: p => readVersion(path.join(fwSrc, p.folder, p.name, 'bower.json')),
      hasVersionCopy: p => fs.existsSync(path.join(app, 'plugins', 'content', p.type, 'versions', p.name, p.version, p.name, 'bower.json')),
      dbRows: p => rowsByType[p.type].filter(r => r.name === p.name)
    }));

    // Not a failure: courses pointing at a theme that is not installed cannot preview (SD had 17 on adapt-adaptx-master).
    const installed = new Set(rowsByType.theme.map(r => r.name));
    const orphaned = (await conn.db.collection('configs').distinct('_theme')).filter(t => t && !installed.has(t));
    if (orphaned.length) console.log(`[verify] WARN: courses use theme(s) with no themetype row: ${orphaned.join(', ')}`);

    if (problems.length) {
      console.error(`[verify] FAILED: ${problems.length} problem(s) in ${expected.length} plugins`);
      problems.slice(0, 40).forEach(p => console.error(`[verify]   ${p}`));
      if (problems.length > 40) console.error(`[verify]   ... and ${problems.length - 40} more`);
      return 1;
    }
    console.log(`[verify] OK: ${expected.length} plugins have a folder, a versions copy and one matching database row`);
    return 0;
  } finally {
    await conn.close();
  }
}

if (require.main === module) {
  setTimeout(() => { console.error('[verify] timed out after 90s'); process.exit(2); }, 90000).unref();
  main().then(code => process.exit(code), err => { console.error(`[verify] could not check: ${err.message}`); process.exit(2); });
}

module.exports = { readExpected, findProblems, connectionString };
