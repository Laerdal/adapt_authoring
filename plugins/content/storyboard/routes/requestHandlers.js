// Request handlers for /api/storyboard/* (ADAPT-3779).
//
// documentJson / _generatedContentMap / audit.meta are stored as JSON strings
// in Mongo (robust round-trip of arbitrary BlockNote JSON, independent of the
// custom schema importer) and exposed as parsed objects over the API.

const fs = require('fs');
const path = require('path');
const formidable = require('formidable');
const bytes = require('bytes');
const app = require('../../../../')();
const configuration = require('../../../../lib/configuration');
const db = require('../utils/database');
const ai = require('../utils/aiClient');
const convert = require('../utils/documentConvert');

const STATUSES = ['draft', 'in_review', 'approved'];
const AUDIT_EVENTS = ['status_change', 'generated', 'imported', 'shared'];
const AI_ACTIONS = ['improve', 'rewrite', 'summarize', 'suggest', 'shorten', 'lengthen', 'spelling', 'custom'];

// Resolve the current user + tenant. Prefer passport's req.user, fall back to
// the usermanager (same convention as the templating plugin).
function userCtx(req) {
  const user = req && req.user && req.user._id ? req.user : app.usermanager.getCurrentUser();
  return {
    userId: user && user._id,
    tenantId: user && user.tenant && user.tenant._id,
  };
}

function safeParse(value, fallback) {
  if (typeof value !== 'string') return value == null ? fallback : value;
  try {
    return JSON.parse(value);
  } catch (e) {
    return fallback;
  }
}

function toPlain(doc) {
  return doc && typeof doc.toObject === 'function' ? doc.toObject() : doc;
}

function serializeStoryboard(doc) {
  const o = toPlain(doc);
  if (!o) return o;
  return {
    ...o,
    documentJson: safeParse(o.documentJson, []),
    _generatedContentMap: safeParse(o._generatedContentMap, {}),
  };
}

function serializeAudit(doc) {
  const o = toPlain(doc);
  if (!o) return o;
  return { ...o, meta: safeParse(o.meta, {}) };
}

function fail(res, error, message) {
  console.error(`[storyboard] ${message}:`, error);
  return res.status(500).json({ error: message });
}

// ── Storyboard documents ────────────────────────────────────────────────────

async function createStoryboard(req, res) {
  try {
    const { userId, tenantId } = userCtx(req);
    const body = req.body || {};
    if (!body._courseId) return res.status(400).json({ error: '_courseId is required' });

    const data = {
      _courseId: body._courseId,
      _tenantId: tenantId,
      createdBy: userId,
      title: body.title || 'Untitled Storyboard',
      status: STATUSES.includes(body.status) ? body.status : 'draft',
      version: 1,
      documentJson: JSON.stringify(body.documentJson != null ? body.documentJson : []),
      _generatedContentMap: JSON.stringify(body._generatedContentMap != null ? body._generatedContentMap : {}),
    };
    const created = await db.create('storyboard', data);
    return res.status(201).json(serializeStoryboard(created));
  } catch (error) {
    return fail(res, error, 'Failed to create storyboard');
  }
}

async function getStoryboardByCourse(req, res) {
  try {
    const results = await db.retrieve('storyboard', { _courseId: req.params.courseId });
    const rec = Array.isArray(results) && results.length ? results[0] : null;
    return res.status(200).json(rec ? serializeStoryboard(rec) : null);
  } catch (error) {
    return fail(res, error, 'Failed to retrieve storyboard by course');
  }
}

async function getStoryboard(req, res) {
  try {
    const results = await db.retrieve('storyboard', { _id: req.params.id });
    if (!Array.isArray(results) || !results.length) {
      return res.status(404).json({ error: 'Storyboard not found' });
    }
    return res.status(200).json(serializeStoryboard(results[0]));
  } catch (error) {
    return fail(res, error, 'Failed to retrieve storyboard');
  }
}

async function updateStoryboard(req, res) {
  try {
    const { userId } = userCtx(req);
    const body = req.body || {};
    const delta = { updatedBy: userId };
    if (typeof body.title === 'string') delta.title = body.title;
    if (STATUSES.includes(body.status)) delta.status = body.status;
    if (typeof body.version === 'number') delta.version = body.version;
    if (body.documentJson !== undefined) delta.documentJson = JSON.stringify(body.documentJson);
    if (body._generatedContentMap !== undefined) {
      delta._generatedContentMap = JSON.stringify(body._generatedContentMap);
    }

    await db.update('storyboard', { _id: req.params.id }, delta);
    const results = await db.retrieve('storyboard', { _id: req.params.id });
    return res.status(200).json(serializeStoryboard(results[0]));
  } catch (error) {
    return fail(res, error, 'Failed to update storyboard');
  }
}

// Change status AND append an immutable status_change audit event (AC8).
async function setStoryboardStatus(req, res) {
  try {
    const { userId, tenantId } = userCtx(req);
    const status = (req.body || {}).status;
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of ${STATUSES.join(', ')}` });
    }
    const existing = await db.retrieve('storyboard', { _id: req.params.id });
    if (!Array.isArray(existing) || !existing.length) {
      return res.status(404).json({ error: 'Storyboard not found' });
    }
    const current = toPlain(existing[0]);
    const fromStatus = current.status;

    await db.update('storyboard', { _id: req.params.id }, { status, updatedBy: userId });
    await db.create('storyboardaudit', {
      _storyboardId: req.params.id,
      _courseId: current._courseId,
      _tenantId: tenantId,
      createdBy: userId,
      event: 'status_change',
      fromStatus,
      toStatus: status,
      meta: '{}',
    });

    const updated = await db.retrieve('storyboard', { _id: req.params.id });
    return res.status(200).json(serializeStoryboard(updated[0]));
  } catch (error) {
    return fail(res, error, 'Failed to change storyboard status');
  }
}

// Comment-driven status workflow: Draft (no comments) -> In Review (at least
// one unresolved top-level comment) -> Approved (one or more comments, all
// top-level ones resolved). Replies (_parentCommentId set) don't count,
// matching the existing openCount/resolvedCount convention already used by
// the Review Center panel. Called after every comment add/resolve/delete —
// the manual status-cycle endpoint (setStoryboardStatus) and UI control have
// been removed in favour of this being fully automatic.
async function recomputeStatus(storyboardId, ctx) {
  try {
    const comments = (await db.retrieve('storyboardcomment', { _storyboardId: storyboardId })) || [];
    const topLevel = comments.map(toPlain).filter((c) => !c._parentCommentId);
    const hasOpen = topLevel.some((c) => !c.resolved);
    const nextStatus = topLevel.length === 0 ? 'draft' : hasOpen ? 'in_review' : 'approved';

    const existing = await db.retrieve('storyboard', { _id: storyboardId });
    if (!Array.isArray(existing) || !existing.length) return;
    const current = toPlain(existing[0]);
    if (current.status === nextStatus) return;

    await db.update('storyboard', { _id: storyboardId }, { status: nextStatus, updatedBy: ctx.userId });
    await db.create('storyboardaudit', {
      _storyboardId: storyboardId,
      _courseId: current._courseId,
      _tenantId: ctx.tenantId,
      createdBy: ctx.userId,
      event: 'status_change',
      fromStatus: current.status,
      toStatus: nextStatus,
      meta: '{}',
    });
  } catch (error) {
    // Non-fatal — the comment action itself already succeeded; a failed
    // status recompute shouldn't surface as a comment-save error.
    console.error('[storyboard] failed to recompute status:', error && error.message);
  }
}

// Share the storyboard with reviewers (users of this instance) and append a
// 'shared' audit event. Replaces the reviewer list wholesale — the client
// always sends the full desired set, same convention as course _shareWithUsers.
async function shareStoryboard(req, res) {
  try {
    const { userId, tenantId } = userCtx(req);
    const body = req.body || {};
    const userIds = Array.isArray(body.userIds) ? body.userIds : [];

    const existing = await db.retrieve('storyboard', { _id: req.params.id });
    if (!Array.isArray(existing) || !existing.length) {
      return res.status(404).json({ error: 'Storyboard not found' });
    }
    const current = toPlain(existing[0]);

    await db.update('storyboard', { _id: req.params.id }, { _shareWithUsers: userIds, updatedBy: userId });
    await db.create('storyboardaudit', {
      _storyboardId: req.params.id,
      _courseId: current._courseId,
      _tenantId: tenantId,
      createdBy: userId,
      event: 'shared',
      meta: JSON.stringify({ userIds }),
    });

    const updated = await db.retrieve('storyboard', { _id: req.params.id });
    return res.status(200).json(serializeStoryboard(updated[0]));
  } catch (error) {
    return fail(res, error, 'Failed to share storyboard');
  }
}

async function deleteStoryboard(req, res) {
  try {
    await db.destroy('storyboard', { _id: req.params.id });
    return res.status(200).json({ success: true });
  } catch (error) {
    return fail(res, error, 'Failed to delete storyboard');
  }
}

// ── Comments (AC9) ───────────────────────────────────────────────────────────

async function listComments(req, res) {
  try {
    const results = (await db.retrieve('storyboardcomment', { _storyboardId: req.params.id })) || [];
    const sorted = results
      .map(toPlain)
      .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    return res.status(200).json(sorted);
  } catch (error) {
    return fail(res, error, 'Failed to list comments');
  }
}

// Comments are Page/Article-level only (never Block/Component) — see
// HEADING_LEVEL_TO_ADAPT in new-ui-source: heading level 1 = Topic/Page,
// level 2 = Section/Article. The client already resolves the cursor to the
// nearest enclosing level-1/2 heading before sending blockId; this re-checks
// it server-side so the rule holds regardless of caller.
//
// documentJson is only persisted on explicit Save/Generate/Export, not on
// every keystroke, so a heading the author just typed may not exist in it
// yet — fail OPEN when the block can't be found (don't block an in-progress
// comment on unsaved content) and only reject a CONFIRMED Block/Component
// target (found, and it's a level-3+ heading or a non-heading block).
async function findCommentableHeading(storyboardId, blockId) {
  const existing = await db.retrieve('storyboard', { _id: storyboardId });
  if (!Array.isArray(existing) || !existing.length) return { error: 'Storyboard not found', status: 404 };

  let blocks = [];
  try {
    blocks = JSON.parse(toPlain(existing[0]).documentJson || '[]');
  } catch {
    blocks = [];
  }
  const target = Array.isArray(blocks) ? blocks.find((b) => b && b.id === blockId) : null;
  if (!target) return {};
  const level = target.type === 'heading' ? Number((target.props && target.props.level) ?? 1) : null;
  if (level === null || level > 2) {
    return { error: 'Comments can only be attached to a Page (Topic) or Article (Section) heading.', status: 400 };
  }
  return {};
}

async function addComment(req, res) {
  try {
    const { userId, tenantId } = userCtx(req);
    const body = req.body || {};
    if (!body.blockId) return res.status(400).json({ error: 'blockId is required' });
    if (!body.body) return res.status(400).json({ error: 'body is required' });

    if (!body._parentCommentId) {
      const check = await findCommentableHeading(req.params.id, body.blockId);
      if (check.error) return res.status(check.status).json({ error: check.error });
    }

    const data = {
      _storyboardId: req.params.id,
      _courseId: body._courseId,
      _tenantId: tenantId,
      createdBy: userId,
      blockId: body.blockId,
      body: body.body,
      resolved: false,
    };
    if (body._parentCommentId) data._parentCommentId = body._parentCommentId;

    const created = await db.create('storyboardcomment', data);
    await recomputeStatus(req.params.id, { userId, tenantId });
    return res.status(201).json(toPlain(created));
  } catch (error) {
    return fail(res, error, 'Failed to add comment');
  }
}

async function updateComment(req, res) {
  try {
    const { userId, tenantId } = userCtx(req);
    const body = req.body || {};
    const delta = { updatedBy: userId };
    if (typeof body.body === 'string') delta.body = body.body;
    if (typeof body.resolved === 'boolean') delta.resolved = body.resolved;

    await db.update('storyboardcomment', { _id: req.params.commentId }, delta);
    const results = await db.retrieve('storyboardcomment', { _id: req.params.commentId });
    if (!Array.isArray(results) || !results.length) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    const updated = toPlain(results[0]);
    if (updated._storyboardId) await recomputeStatus(updated._storyboardId, { userId, tenantId });
    return res.status(200).json(updated);
  } catch (error) {
    return fail(res, error, 'Failed to update comment');
  }
}

async function deleteComment(req, res) {
  try {
    const { userId, tenantId } = userCtx(req);
    // Capture which storyboard this comment belonged to BEFORE deleting it —
    // recomputeStatus needs it, and it's gone once the record is destroyed.
    const existing = await db.retrieve('storyboardcomment', { _id: req.params.commentId });
    const storyboardId = Array.isArray(existing) && existing.length ? toPlain(existing[0])._storyboardId : undefined;
    await db.destroy('storyboardcomment', { _id: req.params.commentId });
    if (storyboardId) await recomputeStatus(storyboardId, { userId, tenantId });
    return res.status(200).json({ success: true });
  } catch (error) {
    return fail(res, error, 'Failed to delete comment');
  }
}

// ── Audit trail (AC8) — append-only ──────────────────────────────────────────

async function listAudit(req, res) {
  try {
    const results = (await db.retrieve('storyboardaudit', { _storyboardId: req.params.id })) || [];
    const sorted = results
      .map(serializeAudit)
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return res.status(200).json(sorted);
  } catch (error) {
    return fail(res, error, 'Failed to list audit events');
  }
}

async function addAudit(req, res) {
  try {
    const { userId, tenantId } = userCtx(req);
    const body = req.body || {};
    if (!AUDIT_EVENTS.includes(body.event)) {
      return res.status(400).json({ error: `event must be one of ${AUDIT_EVENTS.join(', ')}` });
    }
    const data = {
      _storyboardId: req.params.id,
      _courseId: body._courseId,
      _tenantId: tenantId,
      createdBy: userId,
      event: body.event,
      fromStatus: body.fromStatus,
      toStatus: body.toStatus,
      meta: JSON.stringify(body.meta != null ? body.meta : {}),
    };
    const created = await db.create('storyboardaudit', data);
    return res.status(201).json(serializeAudit(created));
  } catch (error) {
    return fail(res, error, 'Failed to add audit event');
  }
}

// ── AI assistance (AC7) — server-side proxy, key never leaves the server ─────

async function handleAi(req, res) {
  try {
    const body = req.body || {};
    const action = AI_ACTIONS.includes(body.action) ? body.action : 'improve';
    const text = String(body.text || '');
    const instruction = String(body.instruction || '');
    // 'custom' (free-text) may generate from scratch with only an instruction;
    // every other action operates on `text`.
    if (action === 'custom') {
      if (!text.trim() && !instruction.trim()) {
        return res.status(400).json({ error: 'text or instruction is required' });
      }
    } else if (!text.trim()) {
      return res.status(400).json({ error: 'text is required' });
    }
    const result = await ai.run(action, text, body.context, instruction);
    return res.status(200).json({ text: result });
  } catch (error) {
    const code = error && error.statusCode ? error.statusCode : 500;
    console.error('[storyboard] AI action failed:', error && error.message);
    return res.status(code).json({ error: (error && error.message) || 'AI request failed' });
  }
}

// ── Import / Export (AC10) ───────────────────────────────────────────────────
// Export still exchanges binary as base64 in JSON (small payloads, no file on
// disk to manage). Import (ADAPT-3760) uses real multipart upload instead —
// the same formidable pattern as lib/assetmanager.js's asset upload route —
// so it gets a real file-size limit (`maxFileUploadSize`, not the generic 5MB
// JSON body cap) and safe temp-file handling for free.

async function exportWord(req, res) {
  try {
    const results = await db.retrieve('storyboard', { _id: req.params.id });
    if (!Array.isArray(results) || !results.length) {
      return res.status(404).json({ error: 'Storyboard not found' });
    }
    const rec = toPlain(results[0]);
    // Prefer the course title (passed by the client) so the document heading
    // and filename match the course, not the internal storyboard record title.
    const docTitle = (req.query && req.query.title) || rec.title || 'Storyboard';
    const blocks = safeParse(rec.documentJson, []);
    // Explicit user/tenant context so the asset resolver doesn't depend on
    // process.domain.session surviving through async awaits (ADAPT-3785 image
    // embedding fix).
    const { userId, tenantId } = userCtx(req);
    const ctx = { user: req.user, userId, tenantId };
    // Stamp the course + storyboard id into the exported file so a later
    // import can map it back to this course (ADAPT-3760 import enhancements
    // — Course-ID-based mapping) — see utils/normalize/reimportMetadata.
    const buffer = await convert.blocksToDocx(blocks, docTitle, ctx, { courseId: rec._courseId, storyboardId: rec._id });
    // Filename is keyed on Course ID, not the course title (ADAPT-3760).
    const safeName = String(rec._courseId || docTitle).replace(/[^\w.-]+/g, '_') || 'storyboard';
    return res.status(200).json({
      filename: `${safeName}.docx`,
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      dataBase64: buffer.toString('base64'),
    });
  } catch (error) {
    return fail(res, error, 'Failed to export Word document');
  }
}

async function exportPdf(req, res) {
  try {
    const results = await db.retrieve('storyboard', { _id: req.params.id });
    if (!Array.isArray(results) || !results.length) {
      return res.status(404).json({ error: 'Storyboard not found' });
    }
    const rec = toPlain(results[0]);
    const docTitle = (req.query && req.query.title) || rec.title || 'Storyboard';
    const blocks = safeParse(rec.documentJson, []);
    const { userId, tenantId } = userCtx(req);
    const ctx = { user: req.user, userId, tenantId };
    const buffer = await convert.blocksToPdf(blocks, docTitle, ctx);
    // Filename is keyed on Course ID, not the course title (ADAPT-3760).
    const safeName = String(rec._courseId || docTitle).replace(/[^\w.-]+/g, '_') || 'storyboard';
    return res.status(200).json({
      filename: `${safeName}.pdf`,
      mime: 'application/pdf',
      dataBase64: buffer.toString('base64'),
    });
  } catch (error) {
    return fail(res, error, 'Failed to export PDF document');
  }
}

// Extension is the source of truth for which parser runs — never trust the
// client-supplied `:format` route param alone (spec: "validate the file
// extension" / "do not trust metadata from uploaded documents").
const EXT_TO_FORMAT = { '.docx': 'word', '.pdf': 'pdf', '.pptx': 'pptx' };
const FORMAT_MIME_TYPES = {
  word: new Set([
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/octet-stream', // some browsers/OSes report this generically
    'application/zip',
  ]),
  pdf: new Set(['application/pdf']),
  pptx: new Set([
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/octet-stream',
    'application/zip',
  ]),
};

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const form = new formidable.IncomingForm();
    form.maxFileSize = configuration.getConfig('maxFileUploadSize');
    form.parse(req, (error, fields, files) => {
      if (error) return reject(error);
      resolve({ fields, files });
    });
  });
}

async function importDocument(req, res) {
  let tempPath;
  try {
    const { files } = await parseMultipart(req);
    const file = files && files.file;
    if (!file) return res.status(400).json({ error: 'A file is required.' });
    tempPath = file.path;

    const ext = path.extname(file.name || '').toLowerCase();
    const format = EXT_TO_FORMAT[ext];
    if (!format) {
      return res.status(400).json({
        error: `Unsupported file format "${ext || '(none)'}" — only .docx, .pdf and .pptx are supported.`,
      });
    }
    const allowedMimes = FORMAT_MIME_TYPES[format];
    if (file.type && allowedMimes && !allowedMimes.has(file.type)) {
      return res.status(400).json({ error: `The file's content type ("${file.type}") does not match a ${ext} file.` });
    }
    if (!fs.statSync(tempPath).size) {
      return res.status(400).json({ error: 'The uploaded file is empty.' });
    }
    const buffer = fs.readFileSync(tempPath);

    let result;
    try {
      if (format === 'word') result = await convert.wordToBlocks(buffer, { sourceFileName: file.name });
      else if (format === 'pptx') result = { normalizedDocument: null, blocks: convert.pptxToBlocks(buffer) };
      else if (format === 'pdf') result = await convert.pdfToBlocks(buffer, { sourceFileName: file.name });
    } catch (parseError) {
      if (parseError && parseError.statusCode) throw parseError;
      const err = new Error(
        `The file could not be read — it may be corrupted, password-protected, or not a valid ${ext} file. (${parseError.message})`,
      );
      err.statusCode = 400;
      throw err;
    }

    return res.status(200).json(result);
  } catch (error) {
    if (error && /maxFileSize exceeded/i.test(error.message || '')) {
      const max = configuration.getConfig('maxFileUploadSize');
      return res.status(400).json({ error: `File exceeds the maximum upload size (${bytes.format(max)}).` });
    }
    const code = error && error.statusCode ? error.statusCode : 500;
    console.error('[storyboard] import failed:', error && error.message);
    return res.status(code).json({ error: (error && error.message) || 'Import failed' });
  } finally {
    // Formidable's own temp file — clean up regardless of outcome (spec:
    // "clean up temporary files using the existing application pattern";
    // the existing assetmanager route doesn't explicitly unlink its own temp
    // file, but doing so here is a safe, contained improvement).
    if (tempPath) fs.unlink(tempPath, () => {});
  }
}

module.exports = {
  createStoryboard,
  getStoryboardByCourse,
  getStoryboard,
  updateStoryboard,
  setStoryboardStatus,
  shareStoryboard,
  deleteStoryboard,
  listComments,
  addComment,
  updateComment,
  deleteComment,
  listAudit,
  addAudit,
  handleAi,
  exportWord,
  exportPdf,
  importDocument,
};
