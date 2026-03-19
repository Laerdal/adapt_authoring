/**
 * ADAPT-3614: Database Performance Diagnostic Script
 *
 * Connects to all tenant databases (using conf/config.json for credentials)
 * and reports:
 *   - Collection document counts and storage sizes
 *   - All indexes currently defined per collection
 *   - EXPLAIN output for the key queries used during Publish/Preview
 *   - Whether queries are using indexes or doing collection scans
 *
 * Run BEFORE and AFTER applying performance fixes to compare results.
 * Output is written to diagnostic-<timestamp>.json for diffing.
 *
 * Usage:
 *   node scripts/db-diagnostic.js [--tenant=<dbName>] [--course=<courseId>] [--save]
 *
 * Options:
 *   --tenant=<dbName>    Target a single tenant database (default: all tenants)
 *   --course=<courseId>  Run EXPLAIN on a specific course ID (default: first course found)
 *   --save               Save JSON report to disk alongside console output
 *   --connection-uri=<uri>  Override connection URI from config
 *
 * Examples:
 *   node scripts/db-diagnostic.js --save
 *   node scripts/db-diagnostic.js --tenant=adapt-tenant-master --course=66a1b2c3d4e5f6a7b8c9d0e1 --save
 */

'use strict';

const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
const fs   = require('fs');

// ── Config ────────────────────────────────────────────────────────────────────

const ROOT       = path.join(__dirname, '..');
const configPath = path.join(ROOT, 'conf', 'config.json');
const config     = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const args = {};
process.argv.slice(2).forEach(arg => {
  const [k, v] = arg.replace(/^--/, '').split('=');
  args[k] = v === undefined ? true : v;
});

const TARGET_TENANT = args['tenant']  || null;
const TARGET_COURSE = args['course']  || null;
const SAVE_REPORT   = !!args['save'];

// ── Connection ────────────────────────────────────────────────────────────────
// Same pattern as lib/database-manager.js and adapt-build/test-connection/index.js.
// SSL/TLS options flow from config.dbOptions so DocumentDB works out of the box.

function buildConnectionUri(dbName) {
  const base = args['connection-uri'] || config.dbConnectionUri || null;
  if (base) {
    // DocumentDB URIs often have an empty db path: host:27017/?tls=true&...
    // Only substitute when there is an explicit non-empty db name in the path;
    // otherwise leave the URI unchanged — client.db(dbName) selects the DB.
    const m = base.match(/^(mongodb(?:\+srv)?:\/\/[^/]+\/)([^/?][^?]*)(\?.*)?$/);
    if (m && m[2]) {
      return `${m[1]}${dbName}${m[3] || ''}`;
    }
    return base;
  }
  const auth = (config.dbUser && config.dbPass)
    ? `${encodeURIComponent(config.dbUser)}:${encodeURIComponent(config.dbPass)}@`
    : '';
  const host    = config.dbHost || '127.0.0.1';
  const port    = config.dbPort ? `:${config.dbPort}` : '';
  const authSrc = config.dbAuthSource ? `?authSource=${config.dbAuthSource}` : '';
  return `mongodb://${auth}${host}${port}/${dbName}${authSrc}`;
}

function buildClientOptions(extra = {}) {
  const dbOpts = config.dbOptions || {};
  const opts = { serverSelectionTimeoutMS: 10000 };
  if (dbOpts.maxPoolSize)               opts.maxPoolSize               = dbOpts.maxPoolSize;
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

// ── Key collections and the queries Adapt runs on them during Publish ─────────
// NOTE: Mongoose auto-pluralises model names → actual MongoDB collection names.
// 'contentobject' model → 'contentobjects' collection (confirmed in migration-report.js).

const CONTENT_COLLECTIONS = ['contentobjects', 'articles', 'blocks', 'components', 'courseassets'];

function buildPublishQueries(courseId) {
  const id = courseId ? new ObjectId(courseId) : null;
  if (!id) return null;
  return [
    { collection: 'contentobjects', filter: { _courseId: id }, sort: { _sortOrder: 1 }, label: 'getCourseJSON: contentobjects by courseId' },
    { collection: 'articles',       filter: { _courseId: id }, sort: { _sortOrder: 1 }, label: 'getCourseJSON: articles by courseId' },
    { collection: 'blocks',         filter: { _courseId: id }, sort: { _sortOrder: 1 }, label: 'getCourseJSON: blocks by courseId' },
    { collection: 'components',     filter: { _courseId: id }, sort: { _sortOrder: 1 }, label: 'getCourseJSON: components by courseId' },
    { collection: 'courseassets',   filter: { _courseId: id, _contentType: { $ne: 'theme' } }, sort: {}, label: 'writeCourseAssets: courseassets by courseId' },
    { collection: 'components',     filter: { _courseId: id }, sort: {}, label: 'getConfigJson: components distinct _component' },
  ];
}

// ── Diagnostic logic ──────────────────────────────────────────────────────────

async function analyseDatabase(dbName, forceExplainCourseId) {
  const uri    = buildConnectionUri(dbName);
  const client = new MongoClient(uri, buildClientOptions());
  const report = { dbName, collections: {}, explainResults: [], warnings: [] };

  try {
    await client.connect();
    const db = client.db(dbName);

    // ── 1. Collection stats ───────────────────────────────────────────────────
    for (const colName of CONTENT_COLLECTIONS) {
      try {
        const stats = await db.command({ collStats: colName });
        const indexes = await db.collection(colName).indexes();
        report.collections[colName] = {
          documentCount:  stats.count,
          storageSizeMB:  (stats.storageSize / 1024 / 1024).toFixed(2),
          indexSizeMB:    (stats.totalIndexSize / 1024 / 1024).toFixed(2),
          indexes: indexes.map(i => ({
            name: i.name,
            key:  i.key,
            unique: i.unique || false
          }))
        };
      } catch (e) {
        report.collections[colName] = { error: e.message };
        report.warnings.push(`Could not stat ${colName}: ${e.message}`);
      }
    }

    // ── 2. Find a sample courseId if not provided ─────────────────────────────
    let courseId = forceExplainCourseId;
    if (!courseId) {
      const sample = await db.collection('course').findOne({}, { projection: { _id: 1 } });
      if (sample) courseId = sample._id.toString();
    }

    // ── 3. EXPLAIN on key publish queries ─────────────────────────────────────
    if (courseId) {
      report.explainCourseId = courseId;
      const queries = buildPublishQueries(courseId);
      for (const q of queries) {
        try {
          const cursor = db.collection(q.collection)
            .find(q.filter)
            .sort(q.sort);
          const explained = await cursor.explain('executionStats');
          const stage     = explained.executionStats;
          const winStage  = explained.queryPlanner.winningPlan;

          const usesIndex = JSON.stringify(winStage).includes('IXSCAN');
          const result = {
            label:            q.label,
            collection:       q.collection,
            docsExamined:     stage.totalDocsExamined,
            docsReturned:     stage.nReturned,
            executionTimeMs:  stage.executionTimeMillis,
            usesIndex,
            winningPlan:      winStage.stage || JSON.stringify(winStage).slice(0, 120),
          };
          report.explainResults.push(result);
        } catch (e) {
          report.explainResults.push({ label: q.label, error: e.message });
          report.warnings.push(`EXPLAIN failed for ${q.label}: ${e.message}`);
        }
      }
    } else {
      report.warnings.push('No course found — skipping EXPLAIN. Pass --course=<id> to force.');
    }
  } finally {
    await client.close();
  }

  return report;
}

// ── Output ────────────────────────────────────────────────────────────────────

function printReport(report) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  Database: ${report.dbName}`);
  console.log('═'.repeat(70));

  // Collection stats + indexes
  for (const [col, info] of Object.entries(report.collections)) {
    if (info.error) {
      console.log(`\n  ${col}: ERROR — ${info.error}`);
      continue;
    }
    console.log(`\n  ${col}`);
    console.log(`    Documents : ${info.documentCount.toLocaleString()}`);
    console.log(`    Storage   : ${info.storageSizeMB} MB`);
    console.log(`    Indexes   : ${info.indexSizeMB} MB`);
    if (info.indexes.length === 0) {
      console.log('    ⚠  NO INDEXES DEFINED');
    } else {
      info.indexes.forEach(i => {
        console.log(`    • ${i.name.padEnd(35)} ${JSON.stringify(i.key)}`);
      });
    }
  }

  // EXPLAIN results
  if (report.explainResults.length > 0) {
    console.log(`\n  KEY QUERY EXPLAIN (courseId: ${report.explainCourseId})`);
    console.log('  ' + '─'.repeat(68));
    console.log(`  ${'Query'.padEnd(50)} ${'IndexHit'.padEnd(10)} ${'Docs'.padEnd(8)} ${'ms'.padEnd(6)}`);
    console.log('  ' + '─'.repeat(68));
    for (const r of report.explainResults) {
      if (r.error) {
        console.log(`  ${r.label.slice(0, 50).padEnd(50)} ERROR: ${r.error}`);
        continue;
      }
      const hit  = r.usesIndex ? '✓ INDEX' : '✗ SCAN ';
      const docs = `${r.docsReturned}/${r.docsExamined}`;
      console.log(`  ${r.label.slice(0, 50).padEnd(50)} ${hit.padEnd(10)} ${docs.padEnd(8)} ${r.executionTimeMs}ms`);
    }
  }

  if (report.warnings.length > 0) {
    console.log('\n  Warnings:');
    report.warnings.forEach(w => console.log(`  ⚠  ${w}`));
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═'.repeat(70));
  console.log('  ADAPT-3614: Database Performance Diagnostic');
  console.log(`  Config : ${configPath}`);
  console.log(`  Time   : ${new Date().toISOString()}`);
  console.log('═'.repeat(70));

  const masterDbName = config.dbName || 'adapt-tenant-master';
  let tenantDbs = [masterDbName];

  if (!TARGET_TENANT) {
    // Enumerate all tenant DBs from master
    const masterUri    = buildConnectionUri(masterDbName);
    const masterClient = new MongoClient(masterUri, buildClientOptions());
    try {
      await masterClient.connect();
      const masterDb = masterClient.db(masterDbName);
      const tenants  = await masterDb.collection('tenants').find(
        {}, { projection: { database: 1, name: 1 } }
      ).toArray();
      const additional = tenants
        .map(t => (t.database && t.database.dbName) || null)
        .filter(Boolean)
        .filter(n => n !== masterDbName);
      tenantDbs = [masterDbName, ...new Set(additional)];
      console.log(`\n  Tenant databases found: ${tenantDbs.join(', ')}`);
    } catch (e) {
      console.warn(`  Warning: could not enumerate tenants (${e.message}). Using master DB only.`);
    } finally {
      await masterClient.close();
    }
  } else {
    tenantDbs = [TARGET_TENANT];
  }

  const allReports = [];
  for (const dbName of tenantDbs) {
    console.log(`\nAnalysing ${dbName}...`);
    try {
      const report = await analyseDatabase(dbName, TARGET_COURSE);
      printReport(report);
      allReports.push(report);
    } catch (e) {
      console.error(`  ✗ Failed: ${e.message}`);
    }
  }

  // Summary: flag any collection scans found
  const scans = allReports.flatMap(r =>
    r.explainResults.filter(e => !e.usesIndex && !e.error)
      .map(e => `${r.dbName} / ${e.label}`)
  );
  if (scans.length > 0) {
    console.log('\n' + '═'.repeat(70));
    console.log('  COLLECTION SCANS DETECTED (need indexes):');
    scans.forEach(s => console.log(`  ✗ ${s}`));
    console.log('  Run: node scripts/create-indexes.js');
    console.log('═'.repeat(70));
  } else if (allReports.some(r => r.explainResults.length > 0)) {
    console.log('\n  All key queries are using indexes. ✓');
  }

  if (SAVE_REPORT) {
    const timestamp  = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFile = path.join(ROOT, `diagnostic-${timestamp}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(allReports, null, 2));
    console.log(`\n  Report saved: ${reportFile}`);
  }
}

main().catch(err => {
  console.error('\n✗ Fatal:', err.message);
  process.exit(1);
});
