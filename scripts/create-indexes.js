/**
 * ADAPT-3614: Performance Index Management Script
 *
 * Creates correct compound indexes on all tenant databases.
 * Also drops any previously-created single-field _tenantId indexes
 * that are ineffective in a per-tenant-database architecture.
 *
 * Usage:
 *   node scripts/create-indexes.js [--dry-run] [--drop-only] [--tenant=<tenantDbName>]
 *
 * Options:
 *   --dry-run            Show what would be created/dropped, without executing
 *   --drop-only          Only drop old indexes, do not create new ones
 *   --tenant=<dbName>    Target a single tenant database (default: all tenants)
 *   --connection-uri=<uri>  Override the connection URI from config
 *
 * Examples:
 *   node scripts/create-indexes.js --dry-run
 *   node scripts/create-indexes.js
 *   node scripts/create-indexes.js --tenant=adapt-tenant-master
 */

'use strict';

const { MongoClient } = require('mongodb');
const path = require('path');
const fs = require('fs');

// ── Config ────────────────────────────────────────────────────────────────────

const ROOT = path.join(__dirname, '..');
const configPath = path.join(ROOT, 'conf', 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const args = {};
process.argv.slice(2).forEach(arg => {
  const [k, v] = arg.replace(/^--/, '').split('=');
  args[k] = v === undefined ? true : v;
});

const DRY_RUN   = !!args['dry-run'];
const DROP_ONLY = !!args['drop-only'];
const TARGET_TENANT = args['tenant'] || null;

// ── Connection ────────────────────────────────────────────────────────────────
// Mirrors the approach in lib/database-manager.js and
// database-helpers/test-connection/index.js (adapt-build repo).
// SSL/TLS options come from config.dbOptions so DocumentDB works without
// needing a separate config file.

function buildConnectionUri(dbName) {
  const base = args['connection-uri'] || config.dbConnectionUri || null;
  if (base) {
    // DocumentDB URIs often have an empty db path: host:27017/?tls=true&...
    // Replacing the db name in that URI would corrupt the query string.
    // Only substitute when there is an explicit non-empty db name in the path.
    // Database selection is handled by client.db(dbName) after connect.
    const m = base.match(/^(mongodb(?:\+srv)?:\/\/[^/]+\/)([^/?][^?]*)(\?.*)?$/);
    if (m && m[2]) {
      return `${m[1]}${dbName}${m[3] || ''}`;
    }
    return base; // empty-path URI (e.g. ...27017/?tls=true&...) — leave unchanged
  }
  const auth = (config.dbUser && config.dbPass)
    ? `${encodeURIComponent(config.dbUser)}:${encodeURIComponent(config.dbPass)}@`
    : '';
  const host = config.dbHost || '127.0.0.1';
  const port = config.dbPort ? `:${config.dbPort}` : '';
  const authSource = config.dbAuthSource ? `?authSource=${config.dbAuthSource}` : '';
  return `mongodb://${auth}${host}${port}/${dbName}${authSource}`;
}

// Builds MongoClient options from config.dbOptions.
// Handles DocumentDB (ssl:true, tlsCAFile) and replica sets transparently.
function buildClientOptions(extra = {}) {
  const dbOpts = config.dbOptions || {};
  const opts = { serverSelectionTimeoutMS: 10000 };
  if (dbOpts.maxPoolSize)               opts.maxPoolSize               = dbOpts.maxPoolSize;
  if (dbOpts.minPoolSize)               opts.minPoolSize               = dbOpts.minPoolSize;
  if (dbOpts.socketTimeoutMS)           opts.socketTimeoutMS           = dbOpts.socketTimeoutMS;
  if (dbOpts.serverSelectionTimeoutMS)  opts.serverSelectionTimeoutMS  = dbOpts.serverSelectionTimeoutMS;
  if (dbOpts.ssl || dbOpts.tls) {
    opts.tls = true;
    opts.ssl = true;
    if (dbOpts.tlsCAFile)               opts.tlsCAFile                 = dbOpts.tlsCAFile;
  }
  if (dbOpts.replicaSet)                opts.replicaSet                = dbOpts.replicaSet;
  if (dbOpts.directConnection !== undefined) opts.directConnection     = dbOpts.directConnection;
  return Object.assign(opts, extra);
}

// ── Index Definitions ─────────────────────────────────────────────────────────
//
// Each tenant DB has collections whose hot paths query by _courseId.
// These are the correct indexes for this per-tenant-database architecture.
// (_tenantId indexes are not useful here — each DB belongs to one tenant.)

// NOTE: Mongoose auto-pluralises model names when creating collections.
// Model 'contentobject' → collection 'contentobjects', etc.
// This matches the names used in adapt-build/database-helpers/migration-report.js.

const INDEXES_TO_CREATE = [
  // contentobjects: getCourseJSON queries {_courseId} with sort {_sortOrder:1}
  { collection: 'contentobjects', index: { _courseId: 1, _sortOrder: 1 }, options: { name: 'courseId_sortOrder' } },
  { collection: 'contentobjects', index: { _parentId: 1 },                options: { name: 'parentId' } },
  // articles
  { collection: 'articles',       index: { _courseId: 1, _sortOrder: 1 }, options: { name: 'courseId_sortOrder' } },
  { collection: 'articles',       index: { _parentId: 1 },                options: { name: 'parentId' } },
  // blocks
  { collection: 'blocks',         index: { _courseId: 1, _sortOrder: 1 }, options: { name: 'courseId_sortOrder' } },
  { collection: 'blocks',         index: { _parentId: 1 },                options: { name: 'parentId' } },
  // components
  { collection: 'components',     index: { _courseId: 1, _sortOrder: 1 }, options: { name: 'courseId_sortOrder' } },
  { collection: 'components',     index: { _parentId: 1 },                options: { name: 'parentId' } },
  { collection: 'components',     index: { _courseId: 1, _component: 1 }, options: { name: 'courseId_component' } },
  // courseassets: writeCourseAssets queries {_courseId, _contentType}
  { collection: 'courseassets',   index: { _courseId: 1, _contentType: 1 }, options: { name: 'courseId_contentType' } },
  // courses: common lookup by _id already covered by default; add createdAt for dashboard sorting
  { collection: 'courses',        index: { createdAt: -1 },               options: { name: 'createdAt_desc' } },
];

// Indexes that were potentially created incorrectly in a previous attempt.
// These are standalone _tenantId indexes — useless in per-tenant-DB architecture
// because every document in a tenant DB has the same _tenantId value.
const INDEXES_TO_DROP = [
  { collection: 'contentobjects', name: '_tenantId_1' },
  { collection: 'articles',       name: '_tenantId_1' },
  { collection: 'blocks',         name: '_tenantId_1' },
  { collection: 'components',     name: '_tenantId_1' },
  { collection: 'courseassets',   name: '_tenantId_1' },
  { collection: 'courses',        name: '_tenantId_1' },
  { collection: 'assets',         name: '_tenantId_1' },
  // Also drop any tenantId+courseId compound that was added without sortOrder
  { collection: 'contentobjects', name: '_tenantId_1__courseId_1' },
  { collection: 'articles',       name: '_tenantId_1__courseId_1' },
  { collection: 'blocks',         name: '_tenantId_1__courseId_1' },
  { collection: 'components',     name: '_tenantId_1__courseId_1' },
  { collection: 'courseassets',   name: '_tenantId_1__courseId_1' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function log(level, ...msg) {
  const prefix = { info: '  ', warn: '⚠ ', error: '✗ ', ok: '✓ ', skip: '– ' };
  console.log(`${prefix[level] || '  '}${msg.join(' ')}`);
}

async function dropIndexIfExists(collection, indexName) {
  let existing;
  try {
    existing = await collection.indexes();
  } catch (e) {
    return; // collection may not exist
  }
  const found = existing.find(i => i.name === indexName);
  if (!found) {
    log('skip', `No index "${indexName}" on ${collection.collectionName} — skipping drop`);
    return;
  }
  if (DRY_RUN) {
    log('warn', `[DRY RUN] Would drop index "${indexName}" on ${collection.collectionName}`);
    return;
  }
  await collection.dropIndex(indexName);
  log('ok', `Dropped index "${indexName}" on ${collection.collectionName}`);
}

async function createIndexIfMissing(collection, indexSpec, options) {
  let existing;
  try {
    existing = await collection.indexes();
  } catch (e) {
    return; // collection may not exist yet
  }
  const found = existing.find(i => i.name === options.name);
  if (found) {
    log('skip', `Index "${options.name}" already exists on ${collection.collectionName}`);
    return;
  }
  if (DRY_RUN) {
    log('warn', `[DRY RUN] Would create index "${options.name}" on ${collection.collectionName}: ${JSON.stringify(indexSpec)}`);
    return;
  }
  await collection.createIndex(indexSpec, { ...options, background: true });
  log('ok', `Created index "${options.name}" on ${collection.collectionName}`);
}

// ── Per-DB Work ───────────────────────────────────────────────────────────────

async function processDatabase(uri, dbName) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  Database: ${dbName}`);
  console.log('─'.repeat(60));

  const client = new MongoClient(uri, buildClientOptions());
  try {
    await client.connect();
    const db = client.db(dbName);

    // Step 1: Drop bad indexes
    console.log('\n  [1] Dropping previously-created ineffective indexes...');
    for (const { collection: colName, name } of INDEXES_TO_DROP) {
      const col = db.collection(colName);
      await dropIndexIfExists(col, name);
    }

    if (!DROP_ONLY) {
      // Step 2: Create correct compound indexes
      console.log('\n  [2] Creating performance indexes...');
      for (const { collection: colName, index, options } of INDEXES_TO_CREATE) {
        const col = db.collection(colName);
        await createIndexIfMissing(col, index, options);
      }
    }
  } finally {
    await client.close();
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═'.repeat(60));
  console.log('  ADAPT-3614: Performance Index Management');
  console.log('═'.repeat(60));
  if (DRY_RUN)   console.log('  MODE: DRY RUN — no changes will be made');
  if (DROP_ONLY) console.log('  MODE: DROP ONLY — indexes will be removed, none created');
  console.log();

  const masterDbName = config.dbName || 'adapt-tenant-master';

  if (TARGET_TENANT) {
    // Single-tenant mode
    const uri = buildConnectionUri(TARGET_TENANT);
    await processDatabase(uri, TARGET_TENANT);
    console.log('\n  Done.');
    return;
  }

  // Multi-tenant mode: enumerate tenants from master DB
  const masterUri = buildConnectionUri(masterDbName);
  const masterClient = new MongoClient(masterUri, buildClientOptions());

  let tenantDbs = [masterDbName];

  try {
    await masterClient.connect();
    const masterDb = masterClient.db(masterDbName);
    const tenants = await masterDb.collection('tenants').find({}, { projection: { database: 1, name: 1 } }).toArray();
    const additionalDbs = tenants
      .map(t => (t.database && t.database.dbName) || null)
      .filter(Boolean)
      .filter(n => n !== masterDbName);
    tenantDbs = [masterDbName, ...new Set(additionalDbs)];
    console.log(`  Found ${tenantDbs.length} database(s): ${tenantDbs.join(', ')}`);
  } catch (e) {
    console.warn(`  Warning: could not enumerate tenants (${e.message}). Processing master DB only.`);
  } finally {
    await masterClient.close();
  }

  for (const dbName of tenantDbs) {
    const uri = buildConnectionUri(dbName);
    try {
      await processDatabase(uri, dbName);
    } catch (e) {
      log('error', `Failed on ${dbName}: ${e.message}`);
    }
  }

  console.log('\n  All databases processed.');
  if (DRY_RUN) console.log('  Re-run without --dry-run to apply changes.');
}

main().catch(err => {
  console.error('\n✗ Fatal:', err.message);
  process.exit(1);
});
