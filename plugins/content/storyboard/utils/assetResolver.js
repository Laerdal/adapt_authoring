// Server-side asset resolver used by the Storyboard Word/PDF export.
//
// The Storyboard's BlockNote document stores each media reference as one of:
//   • `assetId`       — the DAM asset _id (present when the author picked the
//                       asset via AssetPickerModal)
//   • `link`          — the persisted course path `course/assets/<filename>`
//                       (for DAM assets) or an external URL (http[s]://…)
//   • `url`           — a servable preview URL (`/api/asset/serve/<id>`);
//                       ignored for export because it isn't reachable from
//                       inside the server process.
//
// resolveImageRef() turns any of the above into the actual image bytes + a
// scaled `{ width, height }` transformation for docx's ImageRun. Missing /
// external assets return null so the caller can fall back to a text reference.
//
// ctx (optional): { user, tenantId } — passed from the Express request. The
// resolver goes through the raw db when ctx is present so we don't depend on
// `usermanager.getCurrentUser()` still being reachable via process.domain
// deep in the async chain (which is fragile in Node 20 async/await stacks).

const fs = require('fs');
const path = require('path');
const assetmanager = require('../../../../lib/assetmanager');
const filestorage = require('../../../../lib/filestorage');
const database = require('../../../../lib/database');
const usermanager = require('../../../../lib/usermanager');
const configuration = require('../../../../lib/configuration');

// Max width (px) an embedded image occupies in the exported document. Chosen
// to match the ~6" content column of a default A4/Letter Word page at 96 DPI.
const MAX_WIDTH_PX = 480;
// Fallback dimensions for images whose byte size we can decode but whose
// intrinsic dimensions we cannot (e.g. exotic formats image-size doesn't
// recognise). Keeps the docx renderable rather than throwing.
const FALLBACK_WIDTH = 480;
const FALLBACK_HEIGHT = 320;

const COURSE_ASSETS_PREFIX = 'course/assets/';

// image-size is a lightweight (no native deps) synchronous decoder that
// reads only the file header. Required — the docx spec's `ImageRun` needs
// pixel dimensions to compute EMU-based sizing. We fall back to a fixed
// 480×320 box only if the header can't be parsed.
let sizeOf = null;
try {
  const mod = require('image-size');
  // image-size v2 exports `.imageSize`; v1 is a default export. Support both.
  sizeOf = typeof mod === 'function' ? mod : mod.imageSize || mod.default;
} catch (e) {
  // Optional at load time — the export will still render, just without
  // intrinsic sizing (falls back to FALLBACK_WIDTH × FALLBACK_HEIGHT).
}

function resolveTenantId(ctx) {
  if (ctx && ctx.tenantId) return ctx.tenantId;
  if (ctx && ctx.user && ctx.user.tenant && ctx.user.tenant._id) return ctx.user.tenant._id;
  try {
    return usermanager.getCurrentUser().tenant._id;
  } catch (e) {
    return null;
  }
}

// Raw db lookup — bypasses assetmanager.retrieveAsset's permission check
// (safe here: the caller is exporting a storyboard they already have read
// access to; deleted assets are filtered explicitly below).
function dbRetrieveAsset(query, ctx) {
  return new Promise((resolve) => {
    const tenantId = resolveTenantId(ctx);
    if (!tenantId) return resolve(null);
    try {
      database.getDatabase(
        (err, db) => {
          if (err || !db) return resolve(null);
          const finalQuery = Object.assign({ _isDeleted: { $ne: true } }, query);
          db.retrieve('asset', finalQuery, {}, (rErr, recs) => {
            if (rErr || !Array.isArray(recs) || !recs.length) return resolve(null);
            resolve(recs[0]);
          });
        },
        tenantId,
      );
    } catch (e) {
      resolve(null);
    }
  });
}

// Raw MongoClient fallback used when the Adapt application layer isn't fully
// bootstrapped (verification scripts) OR when database.getDatabase() throws
// because `app` isn't initialised in the current async context. The
// connection string mirrors lib/dml/mongoose/index.js::connect — honouring
// dbConnectionUri, dbUser/dbPass, dbReplicaset and dbAuthSource, not just
// dbHost/dbPort — so deployments that rely on auth/URI config behave the
// same as the running server.
let _rawMongoClient = null;
async function _getRawMongo() {
  if (_rawMongoClient) return _rawMongoClient;
  try {
    const { MongoClient } = require('mongodb');
    const cfg = configuration.getConfig() || {};
    const name = cfg.dbName;
    if (!name) return null;
    let url;
    if (cfg.dbConnectionUri) {
      // The db to use is selected via client.db(dbName) below, so the URI's
      // own database segment (if any) doesn't need rewriting here.
      url = cfg.dbConnectionUri;
    } else {
      // Credentials must be URL-encoded — reserved characters (@ : /) in the
      // user/password would otherwise make the URI's authority segment
      // ambiguous and MongoClient would fail to parse it.
      const auth =
        cfg.dbUser && cfg.dbPass
          ? `${encodeURIComponent(cfg.dbUser)}:${encodeURIComponent(cfg.dbPass)}@`
          : '';
      const hosts =
        Array.isArray(cfg.dbReplicaset) && cfg.dbReplicaset.length
          ? cfg.dbReplicaset.join(',')
          : cfg.dbHost
            ? `${cfg.dbHost}${cfg.dbPort ? `:${cfg.dbPort}` : ''}`
            : null;
      if (!hosts) return null;
      url = `mongodb://${auth}${hosts}/${name}`;
      if (typeof cfg.dbAuthSource === 'string' && cfg.dbAuthSource) {
        url += `?authSource=${cfg.dbAuthSource}`;
      }
    }
    _rawMongoClient = { client: new MongoClient(url), dbName: name };
    await _rawMongoClient.client.connect();
    return _rawMongoClient;
  } catch (e) {
    _rawMongoClient = null;
    return null;
  }
}

async function rawRetrieveAsset(query) {
  try {
    const m = await _getRawMongo();
    if (!m) return null;
    const coll = m.client.db(m.dbName).collection('assets');
    const finalQuery = Object.assign({}, query);
    // Convert string _id to ObjectId if needed.
    if (finalQuery._id && typeof finalQuery._id === 'string') {
      try {
        const { ObjectId } = require('mongodb');
        finalQuery._id = new ObjectId(finalQuery._id);
      } catch (e) { /* leave as string */ }
    }
    finalQuery._isDeleted = { $ne: true };
    return await coll.findOne(finalQuery);
  } catch (e) {
    return null;
  }
}

// Fallback path — the traditional assetmanager call, which requires an
// active process.domain.session. Kept as a last-resort so the resolver still
// works when called from a context where ctx isn't provided.
function amRetrieveAsset(query) {
  return new Promise((resolve) => {
    try {
      assetmanager.retrieveAsset(query, (err, recs) => {
        if (err || !Array.isArray(recs) || !recs.length) return resolve(null);
        resolve(recs[0]);
      });
    } catch (e) {
      resolve(null);
    }
  });
}

// Tenant isolation for the raw lookup paths. Asset records live in the
// master DB's shared `assets` collection with no `_tenantId` of their own —
// tenancy is derived from the uploading user (`createdBy`, whose user record
// carries `_tenantId`). assetmanager's API layer enforces this via ACL
// resource strings, but the raw Mongo path bypasses it, so re-impose the
// check here: an asset is visible when its creator belongs to the requesting
// tenant or to the master tenant (Adapt's shared-asset convention). Records
// whose creator can't be resolved (legacy data) are allowed through — this
// is defence-in-depth, not a new gate that breaks existing exports.
const _userTenantCache = new Map();
async function _lookupUserTenantId(userId) {
  const key = String(userId);
  if (_userTenantCache.has(key)) return _userTenantCache.get(key);
  try {
    const m = await _getRawMongo();
    if (!m) return null;
    const { ObjectId } = require('mongodb');
    let query;
    try { query = { _id: new ObjectId(key) }; } catch (e) { query = { _id: userId }; }
    const rec = await m.client.db(m.dbName).collection('users').findOne(query);
    const tid = rec && rec._tenantId ? String(rec._tenantId) : null;
    _userTenantCache.set(key, tid);
    return tid;
  } catch (e) {
    return null;
  }
}

async function _assetVisibleToTenant(assetRec, tenantId) {
  if (!assetRec || !tenantId || !assetRec.createdBy) return true;
  const creatorTenant = await _lookupUserTenantId(assetRec.createdBy);
  if (!creatorTenant) return true;
  const cfg = configuration.getConfig() || {};
  const masterTenant = cfg.masterTenantID ? String(cfg.masterTenantID) : null;
  return creatorTenant === String(tenantId) || creatorTenant === masterTenant;
}

async function retrieveAsset(query, ctx) {
  // Raw Mongo first — deterministic, no dependency on process.domain or on
  // the Adapt application layer being fully bootstrapped in this async
  // context. Then the Adapt db path (in case of an unusual Mongo topology),
  // then assetmanager as a last resort. Whichever path produced the record,
  // it must pass the tenant-visibility check before being returned —
  // assetmanager.retrieveAsset doesn't tenant-scope individual assets either,
  // so filtering only the raw path would leave the fallback paths open.
  const rec =
    (await rawRetrieveAsset(query)) ||
    (await dbRetrieveAsset(query, ctx)) ||
    (await amRetrieveAsset(query));
  if (!rec) return null;
  return (await _assetVisibleToTenant(rec, resolveTenantId(ctx))) ? rec : null;
}

function getStorage(repository) {
  return new Promise((resolve) => {
    try {
      filestorage.getStorage(repository || 'localfs', (err, storage) =>
        resolve(err ? null : storage),
      );
    } catch (e) {
      resolve(null);
    }
  });
}

// Read a file through a filestorage adapter, buffered — the storage plugin
// stream contract is `createReadStream(path, options, cb=>stream)` (not an
// error-first callback, see plugins/filestorage/localfs/index.js).
function readViaStorage(storage, filePath) {
  return new Promise((resolve, reject) => {
    try {
      storage.createReadStream(filePath, {}, (stream) => {
        if (!stream) return resolve(null);
        const chunks = [];
        stream.on('data', (c) => chunks.push(c));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
      });
    } catch (e) {
      reject(e);
    }
  });
}

// Fast local-fs shortcut. When the storage adapter is `localfs` we can
// resolve the absolute path once and use `fs.readFile` directly (much faster
// than spinning up a read stream per image).
async function readAssetBuffer(assetRec, ctx) {
  // Try filestorage first (works only when process.domain.session is intact —
  // i.e. inside a fresh request handler stack). If it fails, fall through to
  // the direct-disk path built from configuration + tenant name.
  const storage = await getStorage(assetRec.repository);
  if (storage && typeof storage.resolvePath === 'function') {
    try {
      const abs = storage.resolvePath(assetRec.path);
      if (abs && fs.existsSync(abs)) {
        return await fs.promises.readFile(abs);
      }
    } catch (e) {
      /* async context lost getCurrentUser → fall through */
    }
  }
  if (storage) {
    try {
      const buf = await readViaStorage(storage, assetRec.path);
      if (buf) return buf;
    } catch (e) { /* fall through to direct disk */ }
  }
  // Direct filesystem fallback — uses the same dataRoot + tenantName the
  // localfs adapter would have used. Works for both master and slave tenants
  // as long as we know the tenantId (looked up in ctx or resolved via the
  // asset record's own _tenantId).
  try {
    const cfg = configuration.getConfig();
    const dataRoot = path.join(configuration.serverRoot || process.cwd(), cfg.dataRoot || 'data');
    // Tenant name resolution: prefer ctx.user.tenant.name, then look up by id.
    let tenantName = null;
    if (ctx && ctx.user && ctx.user.tenant && ctx.user.tenant.name) {
      tenantName = ctx.user.tenant.name;
    } else {
      const tenantId = (ctx && ctx.tenantId) || (assetRec._tenantId && assetRec._tenantId.toString());
      if (tenantId) tenantName = await _lookupTenantName(tenantId);
    }
    if (!tenantName) tenantName = cfg.masterTenantName || 'master';
    // assetRec.path may have leading separator ("\assets\..."); normalise to
    // a relative segment before joining. Filesystem safety must not rely on
    // the DB being well-formed: resolve the final path and reject anything
    // that escapes the tenant's data directory (e.g. ".." segments smuggled
    // into assetRec.path — path traversal).
    const rel = String(assetRec.path || '').replace(/^[\\/]+/, '');
    const tenantRoot = path.resolve(dataRoot, tenantName);
    const abs = path.resolve(tenantRoot, rel);
    const contained = path.relative(tenantRoot, abs);
    if (!contained || contained.startsWith('..') || path.isAbsolute(contained)) return null;
    if (fs.existsSync(abs)) return await fs.promises.readFile(abs);
  } catch (e) {
    /* nothing more to try */
  }
  return null;
}

// Cache tenant name lookups so we don't hammer Mongo when a document has
// dozens of asset refs.
const _tenantNameCache = new Map();
async function _lookupTenantName(tenantId) {
  if (_tenantNameCache.has(tenantId)) return _tenantNameCache.get(tenantId);
  try {
    const cfg = configuration.getConfig();
    if (tenantId === cfg.masterTenantID) {
      _tenantNameCache.set(tenantId, cfg.masterTenantName || 'master');
      return _tenantNameCache.get(tenantId);
    }
    const m = await _getRawMongo();
    if (!m) return null;
    const { ObjectId } = require('mongodb');
    let query;
    try { query = { _id: new ObjectId(tenantId) }; } catch (e) { query = { _id: tenantId }; }
    const rec = await m.client.db(m.dbName).collection('tenants').findOne(query);
    const name = rec && rec.name;
    if (name) _tenantNameCache.set(tenantId, name);
    return name || null;
  } catch (e) {
    return null;
  }
}

// Map an asset record's mime type to the `type` string docx expects.
function docxImageType(mimeType, filename) {
  const m = String(mimeType || '').toLowerCase();
  if (m.includes('png')) return 'png';
  if (m.includes('jpeg') || m.includes('jpg')) return 'jpg';
  if (m.includes('gif')) return 'gif';
  if (m.includes('bmp')) return 'bmp';
  if (m.includes('svg')) return 'svg';
  const ext = String(path.extname(filename || '')).replace('.', '').toLowerCase();
  if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg'].includes(ext)) return ext === 'jpeg' ? 'jpg' : ext;
  return 'png';
}

function scaleToMaxWidth(width, height, maxWidth) {
  if (!width || !height) return { width: FALLBACK_WIDTH, height: FALLBACK_HEIGHT };
  if (width <= maxWidth) return { width, height };
  const scale = maxWidth / width;
  return { width: maxWidth, height: Math.round(height * scale) };
}

// Given a stored media/image ref, resolve to `{ buffer, type, width, height,
// alt }` or `null` if the asset isn't reachable (external URL, deleted, no
// permission). Preserves aspect ratio, capped at MAX_WIDTH_PX.
async function resolveImageRef(ref, ctx) {
  if (!ref || typeof ref !== 'object') return null;
  const link = String(ref.link || '');
  const assetId = ref.assetId || ref._assetId || '';

  let assetRec = null;
  if (assetId) assetRec = await retrieveAsset({ _id: assetId }, ctx);
  if (!assetRec && link.startsWith(COURSE_ASSETS_PREFIX)) {
    const filename = link.slice(COURSE_ASSETS_PREFIX.length);
    if (filename) assetRec = await retrieveAsset({ filename }, ctx);
  }
  if (!assetRec) return null;

  const buffer = await readAssetBuffer(assetRec, ctx);
  if (!buffer || !buffer.length) return null;

  let width = FALLBACK_WIDTH;
  let height = FALLBACK_HEIGHT;
  if (sizeOf) {
    try {
      const dim = sizeOf(buffer);
      if (dim && dim.width && dim.height) {
        const sized = scaleToMaxWidth(dim.width, dim.height, MAX_WIDTH_PX);
        width = sized.width;
        height = sized.height;
      }
    } catch (e) {
      /* fall back to FALLBACK_* */
    }
  }

  return {
    buffer,
    type: docxImageType(assetRec.mimeType, assetRec.filename),
    width,
    height,
    alt: String(ref.alt || assetRec.title || assetRec.filename || ''),
  };
}

// Accept either a full ref object (`{ link, assetId, alt }`) or a bare link
// string — the emitCard-side data has been through a couple of iterations so
// keep back-compat.
async function resolveAnyImage(input, ctx) {
  if (!input) return null;
  if (typeof input === 'string') return resolveImageRef({ link: input }, ctx);
  return resolveImageRef(input, ctx);
}

module.exports = { resolveImageRef, resolveAnyImage };
