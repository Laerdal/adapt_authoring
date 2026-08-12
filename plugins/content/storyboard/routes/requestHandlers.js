// Request handlers for /api/storyboard/* (ADAPT-3779).
//
// documentJson / _generatedContentMap / audit.meta are stored as JSON strings
// in Mongo (robust round-trip of arbitrary BlockNote JSON, independent of the
// custom schema importer) and exposed as parsed objects over the API.

const app = require('../../../../')();
const db = require('../utils/database');
const ai = require('../utils/aiClient');
const convert = require('../utils/documentConvert');

const STATUSES = ['draft', 'in_review', 'approved'];
const AUDIT_EVENTS = ['status_change', 'generated', 'imported'];
const AI_ACTIONS = ['improve', 'rewrite', 'summarize', 'suggest'];

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

async function addComment(req, res) {
  try {
    const { userId, tenantId } = userCtx(req);
    const body = req.body || {};
    if (!body.blockId) return res.status(400).json({ error: 'blockId is required' });
    if (!body.body) return res.status(400).json({ error: 'body is required' });

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
    return res.status(201).json(toPlain(created));
  } catch (error) {
    return fail(res, error, 'Failed to add comment');
  }
}

async function updateComment(req, res) {
  try {
    const { userId } = userCtx(req);
    const body = req.body || {};
    const delta = { updatedBy: userId };
    if (typeof body.body === 'string') delta.body = body.body;
    if (typeof body.resolved === 'boolean') delta.resolved = body.resolved;

    await db.update('storyboardcomment', { _id: req.params.commentId }, delta);
    const results = await db.retrieve('storyboardcomment', { _id: req.params.commentId });
    if (!Array.isArray(results) || !results.length) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    return res.status(200).json(toPlain(results[0]));
  } catch (error) {
    return fail(res, error, 'Failed to update comment');
  }
}

async function deleteComment(req, res) {
  try {
    await db.destroy('storyboardcomment', { _id: req.params.commentId });
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
    if (!text.trim()) return res.status(400).json({ error: 'text is required' });
    const result = await ai.run(action, text, body.context);
    return res.status(200).json({ text: result });
  } catch (error) {
    const code = error && error.statusCode ? error.statusCode : 500;
    console.error('[storyboard] AI action failed:', error && error.message);
    return res.status(code).json({ error: (error && error.message) || 'AI request failed' });
  }
}

// ── Import / Export (AC10) ───────────────────────────────────────────────────
// Binary is exchanged as base64 in JSON so it flows through the standard JSON
// client (no multipart/multer wiring needed).

async function exportWord(req, res) {
  try {
    const results = await db.retrieve('storyboard', { _id: req.params.id });
    if (!Array.isArray(results) || !results.length) {
      return res.status(404).json({ error: 'Storyboard not found' });
    }
    const rec = toPlain(results[0]);
    const blocks = safeParse(rec.documentJson, []);
    const buffer = await convert.blocksToDocx(blocks, rec.title || 'Storyboard');
    const safeName = String(rec.title || 'storyboard').replace(/[^\w.-]+/g, '_');
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
    const blocks = safeParse(rec.documentJson, []);
    const buffer = await convert.blocksToPdf(blocks, rec.title || 'Storyboard');
    const safeName = String(rec.title || 'storyboard').replace(/[^\w.-]+/g, '_');
    return res.status(200).json({
      filename: `${safeName}.pdf`,
      mime: 'application/pdf',
      dataBase64: buffer.toString('base64'),
    });
  } catch (error) {
    return fail(res, error, 'Failed to export PDF document');
  }
}

async function importDocument(req, res) {
  try {
    const format = req.params.format;
    const b64 = (req.body || {}).dataBase64;
    if (!b64) return res.status(400).json({ error: 'dataBase64 is required' });
    const buffer = Buffer.from(b64, 'base64');

    let blocks;
    if (format === 'word') blocks = await convert.wordToBlocks(buffer);
    else if (format === 'pptx') blocks = convert.pptxToBlocks(buffer);
    else if (format === 'pdf') blocks = await convert.pdfToBlocks(buffer);
    else return res.status(400).json({ error: `Unsupported import format: ${format}` });

    return res.status(200).json({ blocks });
  } catch (error) {
    const code = error && error.statusCode ? error.statusCode : 500;
    console.error('[storyboard] import failed:', error && error.message);
    return res.status(code).json({ error: (error && error.message) || 'Import failed' });
  }
}

module.exports = {
  createStoryboard,
  getStoryboardByCourse,
  getStoryboard,
  updateStoryboard,
  setStoryboardStatus,
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
