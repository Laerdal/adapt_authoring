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

function normalizeDocxImageType(rawType) {
  const type = String(rawType || '').trim().toLowerCase().replace(/^image\//, '');
  if (type === 'svg+xml') return 'svg';
  if (type === 'jpeg') return 'jpg';
  if (['png', 'jpg', 'gif', 'bmp', 'svg'].includes(type)) return type;
  return type || 'png';
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

// Decode pixel dimensions from a buffer, scaled to MAX_WIDTH_PX — shared by
// both the DAM-asset path and the data-URI path below.
function sizeFromBuffer(buffer) {
  if (!sizeOf) return { width: FALLBACK_WIDTH, height: FALLBACK_HEIGHT };
  try {
    const dim = sizeOf(buffer);
    if (dim && dim.width && dim.height) return scaleToMaxWidth(dim.width, dim.height, MAX_WIDTH_PX);
  } catch (e) {
    /* fall back to FALLBACK_* below */
  }
  return { width: FALLBACK_WIDTH, height: FALLBACK_HEIGHT };
}

// ── External URL fetch ──────────────────────────────────────────────────────
// Storyboard authors can paste ANY external image/video/audio URL — there is
// no fixed allowlist that fits (unlike plugins/output/cdn's checkLinkStatus.js,
// which only ever checks a small set of known CDN hosts). Fetching arbitrary
// author-supplied URLs server-side is an SSRF vector, so every connection
// attempt — including each individual redirect hop — is validated against
// this private/loopback/link-local blocklist before connecting. No existing
// SSRF-guard utility exists anywhere else in this codebase to reuse.

const dns = require('dns');
const net = require('net');
const http = require('http');
const https = require('https');
const { URL } = require('url');

const EXTERNAL_FETCH_TIMEOUT_MS = 10000;
const EXTERNAL_FETCH_MAX_REDIRECTS = 3;
// Shared ceiling with documentConvert.js's PDF_EMBED_MAX_BYTES, so "fetched
// from an external URL" and "read from an internal DAM asset" behave
// consistently rather than having two different arbitrary limits.
const EXTERNAL_FETCH_MAX_BYTES = 15 * 1024 * 1024;

function ipv4ToInt(parts) {
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function isPrivateIPv4(address) {
  const parts = String(address).split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true; // malformed — reject
  const n = ipv4ToInt(parts);
  const inRange = (base, bits) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (n & mask) === (ipv4ToInt(base) & mask);
  };
  return (
    inRange([0, 0, 0, 0], 8) || // 0.0.0.0/8
    inRange([10, 0, 0, 0], 8) || // 10.0.0.0/8 (private)
    inRange([100, 64, 0, 0], 10) || // 100.64.0.0/10 (carrier-grade NAT)
    inRange([127, 0, 0, 0], 8) || // loopback
    inRange([169, 254, 0, 0], 16) || // link-local
    inRange([172, 16, 0, 0], 12) || // 172.16.0.0/12 (private)
    inRange([192, 168, 0, 0], 16) || // 192.168.0.0/16 (private)
    inRange([224, 0, 0, 0], 4) || // multicast
    inRange([240, 0, 0, 0], 4) // reserved
  );
}

// WHATWG URL.hostname keeps the brackets around an IPv6 literal (the
// hostname of `http://[::1]/` is the literal string `[::1]`) — strip them
// before classifying, otherwise isPrivateIPv6's hextet match never fires
// and bracketed private/loopback IPv6 literals sail straight through.
function stripIPv6Brackets(address) {
  const s = String(address);
  return s.startsWith('[') && s.endsWith(']') ? s.slice(1, -1) : s;
}

function isPrivateIPv6(address) {
  const a = stripIPv6Brackets(address).toLowerCase();
  if (a === '::1' || a === '::') return true;
  const firstHextet = a.split(':')[0];
  if (/^fe[89ab]/.test(firstHextet)) return true; // link-local fe80::/10
  if (/^f[cd]/.test(firstHextet)) return true; // unique local fc00::/7
  const mapped = a.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/); // IPv4-mapped — check the embedded address too
  if (mapped) return isPrivateIPv4(mapped[1]);
  return false;
}

function isPrivateAddress(address) {
  const a = stripIPv6Brackets(address);
  return a.includes(':') ? isPrivateIPv6(a) : isPrivateIPv4(a);
}

// Resolves `hostname` once and returns an http(s).request-compatible
// `lookup` callback pinned to that single validated address, so the actual
// TCP connection cannot land anywhere except the address we just checked.
// Handing the hostname to `fetch`/http.request and letting IT resolve
// separately (as a plain SSRF-guard-then-fetch does) leaves a DNS-rebinding
// window open: an attacker-controlled name can answer the validation lookup
// with a public address and the connection's own later lookup with a
// loopback/private one. Every resolved record is still checked (not just
// the one we pin) since a round-robin hostname could validate against a
// public record while a later retry still lands on a private one.
async function resolvePinnedLookup(hostname) {
  const stripped = stripIPv6Brackets(hostname);
  if (stripped.toLowerCase() === 'localhost') {
    throw new Error('Refusing to fetch a private/internal address');
  }
  const ipFamily = net.isIP(stripped);
  if (ipFamily) {
    if (isPrivateAddress(stripped)) throw new Error('Refusing to fetch a private/internal address');
    return (_host, _opts, cb) => cb(null, stripped, ipFamily);
  }
  const records = await dns.promises.lookup(hostname, { all: true, verbatim: true });
  if (!records.length) throw new Error('Could not resolve host');
  for (const rec of records) {
    if (isPrivateAddress(rec.address)) throw new Error('Refusing to fetch a private/internal address');
  }
  const pinned = records[0];
  return (_host, _opts, cb) => cb(null, pinned.address, pinned.family);
}

// Issues a single GET over node's own `http`/`https` modules — not global
// `fetch`, which doesn't exist at all on Node 16 (the oldest runtime this
// repo's package.json `engines` still declares support for) and whose
// `AbortSignal.timeout` helper is newer still. The request's `lookup` option
// is the address `resolvePinnedLookup` already validated, so DNS plays no
// further part in where the socket actually connects; `hostname` is passed
// through unchanged for the Host header / TLS SNI so virtual hosting and
// certificate validation behave exactly as they would for a normal request.
function requestOnce(url, lookup, maxBytes) {
  return new Promise((resolve) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (e) {
      return resolve(null);
    }
    const mod = parsed.protocol === 'https:' ? https : http;
    const req = mod.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: `${parsed.pathname}${parsed.search}`,
        method: 'GET',
        lookup,
        timeout: EXTERNAL_FETCH_TIMEOUT_MS,
        headers: { 'User-Agent': 'adapt-storyboard-export' },
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400) {
          res.resume();
          const location = res.headers.location;
          return resolve(location ? { redirect: location } : null);
        }
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          res.resume();
          return resolve(null);
        }
        const lengthHeader = res.headers['content-length'];
        if (lengthHeader && Number(lengthHeader) > maxBytes) {
          res.resume();
          return resolve(null);
        }
        const contentType = res.headers['content-type'] || '';
        const chunks = [];
        let total = 0;
        res.on('data', (chunk) => {
          total += chunk.length;
          if (total > maxBytes) {
            req.destroy();
            resolve(null);
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType }));
        res.on('error', () => resolve(null));
      },
    );
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', () => resolve(null));
    req.end();
  });
}

// Fetch arbitrary bytes from an external URL, following redirects manually
// (re-validating + re-pinning each hop against the SSRF guard above) and
// enforcing a timeout + size cap. Returns `{ buffer, contentType }` or
// `null` on ANY failure — never throws, since every caller treats "couldn't
// fetch" the same as "not a DAM asset" and falls back to the existing
// link-only rendering that already works today.
async function fetchExternalBytes(rawUrl, maxBytes = EXTERNAL_FETCH_MAX_BYTES) {
  let url = rawUrl;
  try {
    for (let hop = 0; hop <= EXTERNAL_FETCH_MAX_REDIRECTS; hop += 1) {
      let parsed;
      try {
        parsed = new URL(url);
      } catch (e) {
        return null;
      }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
      // eslint-disable-next-line no-await-in-loop
      const lookup = await resolvePinnedLookup(parsed.hostname);
      // eslint-disable-next-line no-await-in-loop
      const result = await requestOnce(url, lookup, maxBytes);
      if (!result) return null;
      if (result.redirect) {
        url = new URL(result.redirect, url).toString();
        continue;
      }
      return result;
    }
    return null; // too many redirects
  } catch (e) {
    return null;
  }
}

// Fetch an external image URL into the same `{ buffer, type, width, height,
// alt }` shape the DAM/data-URI paths return, so callers don't need to know
// or care where the bytes came from.
async function fetchExternalImage(link, alt) {
  const result = await fetchExternalBytes(link);
  if (!result || !result.buffer.length) return null;
  const { width, height } = sizeFromBuffer(result.buffer);
  const type = docxImageType(result.contentType, link);
  return { buffer: result.buffer, type, width, height, alt: String(alt || '') };
}

// A freshly-imported image (picked in the Storyboard editor but not yet
// Saved/Generated into the course, so it has no DAM asset record yet) is a
// self-contained `data:image/<type>;base64,<data>` URI — decode it directly.
// Without this, the DAM lookup below always misses for such an image and the
// caller (docx/PDF export) fell back to printing the raw base64 string as
// visible text in the exported document.
const DATA_URI_PATTERN = /^data:image\/([a-zA-Z0-9.+-]+);base64,(.+)$/;
function resolveDataUri(link, alt) {
  const m = link.match(DATA_URI_PATTERN);
  if (!m) return null;
  const buffer = Buffer.from(m[2], 'base64');
  if (!buffer.length) return null;
  const { width, height } = sizeFromBuffer(buffer);
  const type = normalizeDocxImageType(m[1]);
  return { buffer, type, width, height, alt: String(alt || '') };
}

// Given a stored media/image ref, resolve to `{ buffer, type, width, height,
// alt }` or `null` if the asset isn't reachable (external URL, deleted, no
// permission). Preserves aspect ratio, capped at MAX_WIDTH_PX.
function normalizeCourseAssetLink(link) {
  if (!link) return '';
  return String(link).trim().replace(/^\/+/, '').replace(/^course\/assets\//i, '');
}

function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch (e) {
    return value;
  }
}

async function findCourseAssetRecord(link, ctx) {
  if (!link) return null;
  const normalized = normalizeCourseAssetLink(link);
  if (!normalized) return null;

  const candidates = new Set();
  const variants = [
    normalized,
    safeDecodeURIComponent(normalized),
    encodeURIComponent(normalized),
    safeDecodeURIComponent(normalized.replace(/^\/+/, '')),
  ];
  for (const variant of variants) {
    if (!variant) continue;
    candidates.add(variant);
    const base = variant.split(/[?#]/)[0];
    if (base && base !== variant) candidates.add(base);
  }

  for (const filename of candidates) {
    const rec = await retrieveAsset({ filename }, ctx);
    if (rec) return rec;
    const pathLike = await retrieveAsset({ path: { $regex: new RegExp(`(?:^|[\\/])${filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }, ctx);
    if (pathLike) return pathLike;
  }

  const raw = await retrieveAsset({ path: { $regex: new RegExp(`(?:^|[\\/])${normalizeCourseAssetLink(link).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }, ctx);
  return raw || null;
}

async function resolveImageRef(ref, ctx) {
  if (!ref || typeof ref !== 'object') return null;
  const link = String(ref.link || '');
  const assetId = ref.assetId || ref._assetId || '';

  const dataUri = resolveDataUri(link, ref.alt);
  if (dataUri) return dataUri;

  let assetRec = null;
  if (assetId) assetRec = await retrieveAsset({ _id: assetId }, ctx);
  if (!assetRec && link.startsWith(COURSE_ASSETS_PREFIX)) {
    assetRec = await findCourseAssetRecord(link, ctx);
  } else if (!assetRec && link.startsWith('/' + COURSE_ASSETS_PREFIX)) {
    assetRec = await findCourseAssetRecord(link.replace(/^\/+/, ''), ctx);
  }
  if (!assetRec) {
    // Not a DAM asset — if it's an external URL, fetch and embed it directly
    // instead of leaving the caller to fall back to a plain clickable link.
    if (/^https?:\/\//i.test(link)) return fetchExternalImage(link, ref.alt);
    return null;
  }

  const buffer = await readAssetBuffer(assetRec, ctx);
  if (!buffer || !buffer.length) return null;

  const { width, height } = sizeFromBuffer(buffer);

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
// Escapes bare '&' that aren't already part of a valid XML entity reference
// (&amp; &lt; &gt; &apos; &quot; or a numeric/hex &#…;). This is the single
// most common defect in hand-edited or externally-exported SVGs (e.g. a
// label reading "Q&A" or "Terms & Conditions") and is enough on its own to
// make librsvg's strict XML parser reject an otherwise-valid image.
function sanitizeSvgMarkup(svgText) {
  return String(svgText).replace(/&(?!(?:amp|lt|gt|apos|quot|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;');
}

async function normalizeImageForEmbedding(resolved) {
  if (!resolved || !resolved.buffer) return resolved;
  const type = String(resolved.type || '').toLowerCase();
  if (type !== 'svg' && type !== 'svg+xml') return resolved;
  const sharp = require('sharp');
  const width = Math.max(1, Number(resolved.width) || FALLBACK_WIDTH);
  const height = Math.max(1, Number(resolved.height) || FALLBACK_HEIGHT);
  try {
    const png = await sharp(resolved.buffer).png().toBuffer();
    return { ...resolved, buffer: png, type: 'png', width, height };
  } catch (e) {
    // Retry against a sanitized copy before giving up — covers the common
    // real-world defect above without silently dropping the image.
    try {
      const repaired = sanitizeSvgMarkup(resolved.buffer.toString('utf8'));
      const png = await sharp(Buffer.from(repaired, 'utf8')).png().toBuffer();
      return { ...resolved, buffer: png, type: 'png', width, height };
    } catch (e2) {
      // Unrecoverable — return null so callers fall back to their text
      // placeholder. A `type: 'svg'` object isn't actually usable here:
      // docx's ImageRun requires a raster `fallback` we can't supply, and
      // pdfkit cannot draw SVG at all.
      return null;
    }
  }
}

async function resolveAnyImage(input, ctx) {
  if (!input) return null;
  if (typeof input === 'string') return resolveImageRef({ link: input }, ctx);
  return resolveImageRef(input, ctx);
}

// Resolve an internal `course/assets/<filename>` link (or `{ link, assetId }`
// ref) to its DB asset record, WITHOUT reading the file bytes — used where the
// caller only needs the record's `_id`/`size`/`mimeType` (e.g. to build a
// servable URL, or to decide whether a file is small enough to embed) and
// doesn't want to pay for a full read when it won't use the buffer. Shares
// the same lookup logic as `resolveImageRef` (assetId first, then filename
// lookup via `findCourseAssetRecord`) but isn't image-specific — usable for
// any asset type (video/audio/etc.).
async function resolveAnyAssetRecord(input, ctx) {
  if (!input) return null;
  const ref = typeof input === 'string' ? { link: input } : input;
  const link = String(ref.link || ref.url || '');
  const assetId = ref.assetId || ref._assetId || '';
  if (!assetId && !link) return null;

  let assetRec = null;
  if (assetId) assetRec = await retrieveAsset({ _id: assetId }, ctx);
  if (!assetRec && link && !/^https?:\/\//i.test(link)) {
    assetRec = await findCourseAssetRecord(link, ctx);
  }
  return assetRec || null;
}

// Thin wrapper so callers that only have an asset record (from
// `resolveAnyAssetRecord` above) don't need to import `readAssetBuffer`
// directly — keeps the asset-reading internals private to this module.
async function readResolvedAssetBuffer(assetRec, ctx) {
  if (!assetRec) return null;
  return readAssetBuffer(assetRec, ctx);
}

module.exports = {
  resolveImageRef,
  resolveAnyImage,
  normalizeImageForEmbedding,
  resolveAnyAssetRecord,
  readResolvedAssetBuffer,
  fetchExternalBytes,
};
