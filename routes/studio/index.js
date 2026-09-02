/**
 * ADAPT Studio — decoupled live authoring surface (engine side).
 *
 * Serves the framework shell from an existing course build, but intercepts the six
 * data files the runtime requests and assembles them LIVE from MongoDB — no grunt
 * rebuild between edits. Also injects a thin "Studio bridge" into the rendered page
 * so the standalone Studio app (running in a parent frame) can drive selection and
 * in-situ text editing over postMessage.
 *
 *   GET /studio                    → landing: list courses for the tenant
 *   GET /studio/:tenant/:course/*  → shell (static) + live data (intercepted) + bridge
 *
 * The framework's data loader (core/js/data.js) fetches JSON over HTTP via $.getJSON,
 * so it is indifferent to static-file vs live-API origin. We exploit exactly that.
 */
const express = require('express');
const path = require('path');
const util = require('util');
const crypto = require('crypto');
const fsx = require('fs-extra');

const configuration = require('../../lib/configuration');
const Constants = require('../../lib/outputmanager').Constants;
const helpers = require('../../lib/helpers');
const installHelpers = require('../../lib/installHelpers');
const logger = require('../../lib/logger');
const usermanager = require('../../lib/usermanager');
const permissions = require('../../lib/permissions');
const origin = require('../../');

const server = module.exports = express();
server.set('views', __dirname);
server.set('view engine', 'hbs');

// The Studio surface enforces its own per-course permission gate (see gateIndex/
// gateAsset below), so exempt /studio/* from the global policy checker — same
// posture as /preview (hardcoded in permissions.js) and /new (routes/new/index.js).
// Data is NOT exposed here: all mutations still go through the gated /api/* routes.
permissions.ignoreRoute(/^\/studio\/?.*$/);

/* ================================================================== *
 * Shell-fingerprint cache — the decoupling of *shell prep* from build.
 *
 * The render shell (framework JS/CSS, theme, menu, plugin bundles, index.html)
 * is determined ENTIRELY by { frameworkVersion, theme, menu, enabled component
 * set, enabled extension set } — never by course content. So we fingerprint on
 * exactly that and cache one shell per fingerprint, shared across courses and
 * across all content edits. Content lives in the 6 live JSON files (served from
 * DB) + per-course assets; it never invalidates the shell.
 *
 *   first time a fingerprint is seen  → build once (grunt), snapshot the shell
 *   any later course with same finger → restore from cache (file copy, no grunt)
 *   any content edit                  → nothing here at all (live JSON only)
 *
 * Population is automatic: we listen for the engine's `previewCreated` event
 * (emitted after every successful build) and snapshot the shell — so normal
 * previews warm the Studio cache too. Nothing in publish.js is modified.
 * ================================================================== */

const SHELLS_DIRNAME = 'studio-shells';
const FP_MARKER = '.studio-fp';

function frameworkRoot() {
  return path.join(
    configuration.serverRoot, Constants.Folders.Temp,
    configuration.getConfig('masterTenantID'), Constants.Folders.Framework
  );
}

function courseBuildRoot(tenantId, courseId) {
  return path.join(
    frameworkRoot(), Constants.Folders.AllCourses, tenantId, courseId, Constants.Folders.Build
  );
}

function shellCacheDir(fingerprint) {
  return path.join(frameworkRoot(), SHELLS_DIRNAME, fingerprint);
}

// Stable set of names from either ['a','b'] or [{name:'a'},…] or {a:{…}} shapes.
function sortedNames(value) {
  if (Array.isArray(value)) return value.map(v => (v && v.name) || v).filter(Boolean).sort();
  if (value && typeof value === 'object') return Object.keys(value).sort();
  return [];
}

// Compute the shell fingerprint for a course from its assembled config + framework version.
function computeFingerprint(tenantId, courseId, cb) {
  origin().outputmanager.getOutputPlugin('adapt', (err, plugin) => {
    if (err) return cb(err);
    // The fingerprint needs ONLY the config (theme/menu/enabled component+extension
    // sets). There is no config-only assembler on OutputPlugin — `getCourseJSON` is
    // the only path that produces the `_enabledComponents`/`_enabledExtensions`
    // aggregate on `config[0]`. It's assembled once per preview, so reusing it here
    // is fine (and it's what publish.js consumes anyway).
    plugin.getCourseJSON(tenantId, courseId, (err, raw) => {
      if (err) return cb(err);
      installHelpers.getInstalledFrameworkVersion((err, fwVersion) => {
        if (err) return cb(err);
        const cfg = (raw && raw.config && raw.config[0]) || {};
        const key = JSON.stringify({
          fw: fwVersion,
          theme: cfg._theme || null,
          menu: cfg._menu || null,
          components: sortedNames(cfg._enabledComponents),
          extensions: sortedNames(cfg._enabledExtensions)
        });
        cb(null, crypto.createHash('sha1').update(key).digest('hex').slice(0, 16));
      });
    });
  });
}

// Everything in the build EXCEPT the per-course `course/` folder is the shell.
function isCoursePayload(buildRoot, srcPath) {
  const courseDir = path.join(buildRoot, Constants.Folders.Course);
  return srcPath === courseDir || srcPath.startsWith(courseDir + path.sep);
}

// Snapshot a freshly-built shell into the fingerprint cache (course payload excluded).
function snapshotShell(buildRoot, fingerprint, cb) {
  const dest = shellCacheDir(fingerprint);
  fsx.emptyDir(dest, err => {
    if (err) return cb(err);
    fsx.copy(buildRoot, dest, { filter: (src) => !isCoursePayload(buildRoot, src) }, cb);
  });
}

// Restore a cached shell into a course build folder, preserving its `course/` payload (assets).
function restoreShell(fingerprint, buildRoot, cb) {
  fsx.copy(shellCacheDir(fingerprint), buildRoot, { overwrite: true }, err => {
    if (err) return cb(err);
    fsx.writeFile(path.join(buildRoot, FP_MARKER), fingerprint, cb);
  });
}

// On any successful build, warm the cache for that course's fingerprint.
(function registerPreviewListener() {
  const app = origin();
  if (!app || typeof app.on !== 'function') return;
  app.on('previewCreated', (tenantId, courseId /*, outputFolder */) => {
    // Wrap in try/catch: this listener runs synchronously from the grunt
    // exec-exit handler in publish.js, so any thrown error bubbles up through
    // `app.emit` → node's uncaughtException handler and crashes the response
    // (surfacing as a 500 to the client even though the build itself succeeded).
    // Cache warming is best-effort; a failure here must never break preview.
    try {
      const buildRoot = courseBuildRoot(String(tenantId), String(courseId));
      computeFingerprint(String(tenantId), String(courseId), (err, fp) => {
        if (err) return logger.log('warn', `Studio: fingerprint failed for ${courseId}: ${err.message}`);
        snapshotShell(buildRoot, fp, (err2) => {
          if (err2) return logger.log('warn', `Studio: shell snapshot failed for ${courseId}: ${err2.message}`);
          fsx.writeFile(path.join(buildRoot, FP_MARKER), fp, () => {});
          logger.log('info', `Studio: cached shell ${fp} for course ${courseId}`);
        });
      });
    } catch (e) {
      logger.log('warn', `Studio: previewCreated handler error for ${courseId}: ${e && e.message}`);
    }
  });
})();

// The six files the Adapt runtime requests, mapped to the assembled-JSON collection
// keys produced by OutputPlugin.getCourseJSON + sanitizeCourseJSON.
const DATA_FILES = {
  'config.json': 'config',
  'course.json': 'course',
  'contentObjects.json': 'contentobject',
  'articles.json': 'article',
  'blocks.json': 'block',
  'components.json': 'component'
};

/* ------------------------------------------------------------------ *
 * Live-JSON assembly cache. The framework requests all six data files in a
 * burst on every page open; assembling+sanitizing the whole course once per
 * file meant SIX full getCourseJSON reads per open. Assemble ONCE and share it:
 *   - in-flight de-duplication collapses the concurrent six requests into a
 *     single DB assembly (they await the same in-progress result);
 *   - a short TTL covers slightly-staggered requests without going stale —
 *     content edits reload the surface, which re-assembles after the TTL.
 * ------------------------------------------------------------------ */
const LIVE_TTL_MS = 3000;
const liveCache = new Map();     // key -> { at, data }
const liveInflight = new Map();  // key -> [callback]

function getSanitizedCourse(tenantId, courseId, cb) {
  const key = tenantId + ':' + courseId;
  const hit = liveCache.get(key);
  if (hit && (Date.now() - hit.at) < LIVE_TTL_MS) return cb(null, hit.data);
  if (liveInflight.has(key)) { liveInflight.get(key).push(cb); return; }
  liveInflight.set(key, [cb]);
  const settle = function (err, data) {
    const waiters = liveInflight.get(key) || [];
    liveInflight.delete(key);
    if (!err && data) liveCache.set(key, { at: Date.now(), data: data });
    waiters.forEach(function (fn) { fn(err, data); });
  };
  origin().outputmanager.getOutputPlugin('adapt', function (err, plugin) {
    if (err) return settle(err);
    plugin.getCourseJSON(tenantId, courseId, function (err, raw) {
      if (err) return settle(err);
      plugin.sanitizeCourseJSON(Constants.Modes.Preview, raw, function (err, sanitized) {
        if (err) return settle(err);
        settle(null, sanitized);
      });
    });
  });
}

function StudioPermissionError(message, httpCode) {
  this.message = message || 'Permission denied';
  this.http_code = httpCode || 401;
}
util.inherits(StudioPermissionError, Error);

/* ------------------------------------------------------------------ *
 * Landing page — pick a course to open in Studio.
 * ------------------------------------------------------------------ */
server.get('/studio', (req, res, next) => {
  const user = usermanager.getCurrentUser();
  if (!user) return next(new StudioPermissionError());
  const tenantId = user.tenant._id.toString();

  origin().contentmanager.getContentPlugin('course', (err, plugin) => {
    if (err) return next(err);
    plugin.retrieve({ _tenantId: tenantId }, {}, (err, courses) => {
      if (err) return next(err);
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.send(renderLanding(tenantId, courses || []));
    });
  });
});

/* ------------------------------------------------------------------ *
 * Ensure-shell — make a render shell matching the course's CURRENT config
 * (theme/menu/extensions) available, WITHOUT touching the preview lifecycle.
 *
 *   marker matches fingerprint   → nothing to do (already materialised)
 *   shell cached for fingerprint → restore by file copy (no grunt)
 *   otherwise                    → build once via the shared compiler, cache it
 *
 * Registered before the greedy '/studio/:tenant/:course/*' route. Returns
 * { built, cached, fingerprint }.
 *
 * POST (not GET): this endpoint has side effects — a cache MISS triggers a grunt
 * shell build (plugin.publish with force). POST prevents accidental triggering by
 * prefetchers/crawlers and matches the verb used for other mutating/expensive
 * operations. Auth is unchanged (session + per-course permission gate below).
 * ------------------------------------------------------------------ */
server.post('/studio/ensure/:tenant/:course', (req, res, next) => {
  const tenantId = req.params.tenant;
  const courseId = req.params.course;
  const user = usermanager.getCurrentUser();
  const masterTenantId = configuration.getConfig('masterTenantID');
  const force = String(req.query.force || '') === 'true';

  if (!user) return next(new StudioPermissionError());
  if (tenantId !== user.tenant._id.toString() && tenantId !== masterTenantId) return next(new StudioPermissionError());

  helpers.hasCoursePermission('*', user._id, tenantId, { _id: courseId }, (error, hasPermission) => {
    if (error || !hasPermission) return next(new StudioPermissionError());

    computeFingerprint(tenantId, courseId, (err, fp) => {
      if (err) return next(err);
      const buildRoot = courseBuildRoot(tenantId, courseId);
      const indexPath = path.join(buildRoot, Constants.Filenames.Main);

      fsx.readFile(path.join(buildRoot, FP_MARKER), 'utf8', (_e, marker) => {
        // 1) Already materialised for this fingerprint.
        if (!force && marker === fp && fsx.existsSync(indexPath)) {
          return res.json({ success: true, built: false, cached: true, fingerprint: fp });
        }
        // 2) Shell cached AND this course already has a build folder (its assets) → restore, no grunt.
        if (!force && fsx.existsSync(path.join(shellCacheDir(fp), Constants.Filenames.Main)) && fsx.existsSync(buildRoot)) {
          return restoreShell(fp, buildRoot, (rErr) => {
            if (rErr) return next(rErr);
            logger.log('info', `Studio: restored cached shell ${fp} for course ${courseId} (no build)`);
            res.json({ success: true, built: false, cached: true, fingerprint: fp });
          });
        }
        // 3) Miss → build once with the shared grunt compiler (NOT the preview route).
        origin().outputmanager.getOutputPlugin('adapt', (pErr, plugin) => {
          if (pErr) return next(pErr);
          plugin.publish(courseId, Constants.Modes.Preview, { query: { force: 'true' } }, {}, (bErr) => {
            if (bErr) return res.json({ success: false, message: bErr.message || String(bErr) });
            // previewCreated has snapshotted the cache; mark this build folder too.
            fsx.writeFile(path.join(buildRoot, FP_MARKER), fp, () => {});
            res.json({ success: true, built: true, cached: false, fingerprint: fp });
          });
        });
      });
    });
  });
});

/* ------------------------------------------------------------------ *
 * Studio surface — static shell + intercepted live data + bridge.
 * ------------------------------------------------------------------ */
server.get('/studio/:tenant/:course/*', (req, res, next) => {
  const tenantId = req.params.tenant;
  const courseId = req.params.course;
  const user = usermanager.getCurrentUser();
  const requested = req.params[0] || Constants.Filenames.Main;
  const masterTenantId = configuration.getConfig('masterTenantID');
  const studioKey = `studio-${tenantId}-${courseId}`;

  if (!user) return onAuthError();

  const isIndex = (requested === Constants.Filenames.Main);
  isIndex ? gateIndex() : gateAsset();

  function onAuthError() {
    logger.log('warn', `Studio: user '${user && user._id}' denied course '${courseId}' on tenant '${tenantId}'`);
    next(new StudioPermissionError());
  }

  function gateIndex() {
    if (!Array.isArray(req.session.studio)) req.session.studio = [];
    if (tenantId !== user.tenant._id.toString() && tenantId !== masterTenantId) return onAuthError();
    helpers.hasCoursePermission('*', user._id, tenantId, { _id: courseId }, (error, hasPermission) => {
      if (error) { logger.log('error', error); return onAuthError(); }
      if (!hasPermission) {
        const at = req.session.studio.indexOf(studioKey);
        if (at > -1) req.session.studio.splice(at, 1);
        return onAuthError();
      }
      if (req.session.studio.indexOf(studioKey) === -1) req.session.studio.push(studioKey);
      sendIndex();
    });
  }

  function gateAsset() {
    if (!Array.isArray(req.session.studio) || req.session.studio.indexOf(studioKey) === -1) {
      return res.status(404).end();
    }
    const basename = path.basename(requested);
    DATA_FILES.hasOwnProperty(basename) ? sendLiveData(basename) : sendStatic(requested);
  }

  // ---- live data: one assembly per page-open burst (deduped + short-TTL cached), no disk, no grunt ----
  function sendLiveData(basename) {
    getSanitizedCourse(tenantId, courseId, (err, sanitized) => {
      if (err) return next(err);
      if (sanitized.config && sanitized.config.build) delete sanitized.config.build;
      const lang = sanitized.config && sanitized.config._defaultLanguage;
      let payload = sanitized[DATA_FILES[basename]];
      if (payload === undefined) payload = [];
      let body = JSON.stringify(payload);
      if (lang) body = body.split('course/assets/').join('course/' + lang + '/assets/');
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.type('application/json').send(body);
    });
  }

  // ---- static shell: framework bundle / css / fonts / assets / index ----
  function buildRoot() {
    return path.join(
      configuration.serverRoot, Constants.Folders.Temp, masterTenantId,
      Constants.Folders.Framework, Constants.Folders.AllCourses,
      tenantId, courseId, Constants.Folders.Build
    );
  }

  function sendStatic(file) {
    res.sendFile(file, { root: buildRoot() }, error => {
      if (error) res.status(error.status || 404).end();
    });
  }

  function sendIndex() {
    if (!Array.isArray(req.session.studio)) req.session.studio = [];
    if (req.session.studio.indexOf(studioKey) === -1) req.session.studio.push(studioKey);
    const fs = require('fs');
    const indexPath = path.join(buildRoot(), Constants.Filenames.Main);
    fs.readFile(indexPath, 'utf8', (err, html) => {
      if (err) {
        logger.log('warn', `Studio: no build shell for course '${courseId}'. Preview the course once to generate it.`);
        return res.status(404).send(renderNoShell(tenantId, courseId));
      }
      // The embedded page editor drives the iframe via direct same-origin DOM, so it
      // neither needs nor wants the postMessage bridge (its click/hover outlines would
      // double up with the editor's own selection visuals). Skip injection when the
      // caller marks itself embedded; the standalone Studio app omits the flag and
      // still receives the bridge.
      const injected = req.query.embedded
        ? html
        : html.replace('</body>', STUDIO_BRIDGE + '\n</body>');
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.type('html').send(injected);
    });
  }
});

/* ------------------------------------------------------------------ *
 * Studio bridge — injected into the framework page; talks to the parent
 * (the standalone Studio app) over postMessage.
 *
 *   iframe → app : studio:ready | studio:selected {id,rect}
 *   app → iframe : studio:highlight {id}
 *
 * One editing model: clicking a component *selects* it; the app edits it in its
 * right-hand panel and persists via the engine content API. The bridge owns
 * selection visuals only — no inline contenteditable, no formatting toolbar — so
 * there is exactly one way to edit and nothing looks half-editable. Selection is
 * always live (no edit-mode switch). Model-first re-render (Adapt.data.set) is the
 * next step, delivered as a bundled framework plugin; injection avoids a rebuild.
 * ------------------------------------------------------------------ */
const STUDIO_BRIDGE = `
<style id="studio-bridge-style">
  .component{ position:relative; }
  .component:hover{ outline:2px solid rgba(23,105,138,.45); outline-offset:2px; cursor:pointer; }
  .component.studio-selected{ outline:2px solid #17698a; outline-offset:2px; }
  .studio-flash{ animation:studioFlash 1s ease; }
  @keyframes studioFlash{ 0%{ outline:3px solid #17698a; outline-offset:2px; } 100%{ outline:2px solid transparent; } }
</style>
<script>
(function(){
  var allowedOrigin = window.location.origin;
  function post(m){ try { window.parent.postMessage(Object.assign({ source:'adapt-studio' }, m), allowedOrigin); } catch(e){} }
  function rectOf(el){ var r = el.getBoundingClientRect(); return { top:r.top, left:r.left, width:r.width, height:r.height }; }

  function announceReady(){ post({ type:'studio:ready' }); }
  if (document.readyState === 'complete') setTimeout(announceReady, 400);
  else window.addEventListener('load', function(){ setTimeout(announceReady, 400); });

  window.addEventListener('message', function(e){
    if (e.source !== window.parent) return;
    if (e.origin !== allowedOrigin) return;
    var d = e.data || {};
    if (d.target !== 'adapt-studio') return;
    if (d.type === 'studio:highlight') highlight(d.id);
  });

  function clearSel(){ var s = document.querySelector('.component.studio-selected'); if (s) s.classList.remove('studio-selected'); }
  function select(c){ clearSel(); c.classList.add('studio-selected'); post({ type:'studio:selected', id:c.getAttribute('data-adapt-id'), rect:rectOf(c) }); }
  function highlight(id){
    var c = document.querySelector('.component[data-adapt-id="' + id + '"]'); if (!c) return;
    c.scrollIntoView({ behavior:'smooth', block:'center' });
    c.classList.add('studio-flash'); setTimeout(function(){ c.classList.remove('studio-flash'); }, 1000);
    select(c);
  }

  document.addEventListener('click', function(e){
    var c = e.target.closest && e.target.closest('.component'); if (!c) return;
    select(c);
  });
})();
</script>`;

/* ------------------------------------------------------------------ *
 * Tiny server-rendered landing (POC). The standalone app is the real UI.
 * ------------------------------------------------------------------ */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function renderLanding(tenantId, courses) {
  const rows = courses.map(c => {
    const title = esc(c.title || c.displayTitle || '(untitled)');
    return `<a class="card" href="/studio/${esc(tenantId)}/${esc(c._id)}/">
      <span class="t">${title}</span><span class="go">Open in Studio →</span></a>`;
  }).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>ADAPT Studio</title>
  <style>
    body{margin:0;font:15px/1.5 system-ui,sans-serif;background:#11151c;color:#eef}
    header{padding:24px 32px;background:#1f2430;display:flex;align-items:center;gap:14px}
    header h1{font-size:18px;margin:0;letter-spacing:.06em}
    header .pill{background:#2e7d32;border-radius:10px;padding:3px 10px;font-size:12px}
    .grid{padding:28px 32px;display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}
    .card{display:flex;flex-direction:column;gap:10px;padding:18px;border-radius:12px;
      background:#1b212c;color:#eef;text-decoration:none;border:1px solid #2a313f;transition:.15s}
    .card:hover{border-color:#4f7cff;transform:translateY(-2px)}
    .card .t{font-weight:600}
    .card .go{font-size:12px;color:#8fa8ff}
    .empty{padding:40px;opacity:.7}
  </style></head><body>
  <header><h1>ADAPT&nbsp;STUDIO</h1><span class="pill">LIVE authoring · no rebuild</span></header>
  ${courses.length ? `<div class="grid">${rows}</div>` : `<p class="empty">No courses found for this tenant.</p>`}
  </body></html>`;
}

function renderNoShell(tenantId, courseId) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Studio — shell missing</title>
  <style>body{font:15px/1.6 system-ui;background:#11151c;color:#eef;padding:48px;max-width:680px;margin:auto}
  code{background:#1f2430;padding:2px 6px;border-radius:4px}</style></head><body>
  <h2>No build shell for this course yet</h2>
  <p>Studio reuses the framework build as its render shell. This course has not been
  built. Open it once via the normal <strong>Preview</strong> to generate the shell, then
  reopen <code>/studio/${esc(tenantId)}/${esc(courseId)}/</code>.</p>
  <p><a style="color:#8fa8ff" href="/studio">← Back to Studio</a></p>
  </body></html>`;
}
