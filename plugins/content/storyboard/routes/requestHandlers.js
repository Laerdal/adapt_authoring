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
const rawDatabase = require('../../../../lib/database');
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

// ── Access control (ADAPT-3760 follow-up: "Share for Review" must actually
// restrict who can review) ──────────────────────────────────────────────────
//
// Every route here previously ran with NO per-record check at all — `rest.js`
// is a bare Express wrapper with no built-in permission layer (unlike the
// `ContentPlugin`-based content types, which get hasPermission auto-wired by
// lib/contentmanager.js), so any authenticated user who knew/guessed a
// storyboard or course id could read/edit/delete/export it. `_shareWithUsers`
// was write-only: the "Share for Review" dialog saved it, but nothing ever
// read it back to gate access, so sharing with specific reviewers didn't
// actually keep anyone else out.
//
// Deliberately self-contained — does NOT call lib/helpers.js's
// hasCoursePermission/evalCoursePermission. That function compares
// `creatorId === userId` and `course._tenantId.toString() !== tenantId`
// without coercing BOTH sides to the same type; `userId`/`tenantId` here come
// straight from `req.user._id`/`req.user.tenant._id`, which on this app's
// session user is a Mongoose ObjectId, not a string. A string is never `===`
// an ObjectId (no coercion on strict equality), so that check silently denies
// the course's own non-admin owner — confirmed by a real "Storyboard not
// found" regression for the storyboard's own creator once this file started
// relying on it. Comparing everything below via `String(...)` on both sides
// avoids that failure mode entirely rather than risking a fix to a
// shared/core permission function this feature doesn't own.
//
// Two tiers:
//  'edit'   — full access (view/comment AND update/delete/status/share/export).
//             Granted to the storyboard's own creator.
//  'review' — view + comment only. Granted to anyone listed in
//             storyboard._shareWithUsers — the actual point of "Share for
//             Review": invite someone to look at and comment on it without
//             handing them edit/export/delete/re-share rights.
// Neither tier existing (`null`) means no access.
//
// Known gap: this does NOT also grant 'edit' to a course-level collaborator
// (course.createdBy/._isShared/._shareWithUsers) or a platform admin who
// didn't personally create the storyboard — doing that reliably needs the
// same safe-comparison treatment applied to the course-permission path too,
// which is out of scope for this fix. A course co-author who needs access
// today can be added via Share for Review same as any other reviewer (at
// 'review' level) until that follow-up lands.
function getStoryboardAccessLevel(record, userId) {
  if (!record) return null;
  const creatorId = record.createdBy && record.createdBy._id ? record.createdBy._id : record.createdBy;
  if (creatorId && String(creatorId) === String(userId)) return 'edit';
  const shared = Array.isArray(record._shareWithUsers) ? record._shareWithUsers.map(String) : [];
  return shared.includes(String(userId)) ? 'review' : null;
}

// Fetches a storyboard by id and resolves the current user's access level in
// one go. `record` comes back null when either the id doesn't exist OR the
// user has no access to it — deliberately indistinguishable, so a 404 never
// leaks whether a given id exists to someone who isn't allowed to see it.
async function loadStoryboardAccess(id, userId) {
  const results = await db.retrieve('storyboard', { _id: id });
  const record = Array.isArray(results) && results.length ? toPlain(results[0]) : null;
  const level = getStoryboardAccessLevel(record, userId);
  return { record: level ? record : null, level };
}

function denyStoryboardAccess(res) {
  return res.status(404).json({ error: 'Storyboard not found' });
}

// `/api/shared/course` (the Dashboard's "Shared with Me" listing — see
// plugins/content/course/index.js) filters on the COURSE's own
// `_shareWithUsers`/`_isShared` fields, entirely separate from the
// storyboard's own `_shareWithUsers` that gates in-app review access
// (getStoryboardAccessLevel above). Share for Review only ever wrote to the
// STORYBOARD record, so an invited reviewer had no `_shareWithUsers`/
// `_isShared` entry on the COURSE itself and so no way to ever discover it —
// "Shared with Me" simply never listed it, regardless of the route-gate and
// per-record fixes already in place. This adds the invited user ids to the
// course's OWN _shareWithUsers too, additively:
//  - Only ADDS ids, never removes any (un-sharing a storyboard reviewer does
//    NOT revoke course access — they might legitimately have it for other
//    reasons this code has no visibility into; avoiding any removal here
//    keeps this change purely additive and unable to break existing access).
//  - Skips the write entirely when there's nothing new to add.
//  - Best-effort: any failure here is logged, never thrown — Share for
//    Review's own (already-succeeded) storyboard-level sharing must not be
//    rolled back or reported as failed just because this side-effect failed.
//  - Deliberately bypasses app.contentmanager/ContentPlugin.update for
//    'course' (i.e. does NOT go through the `db` from utils/database.js used
//    everywhere else in this file) — that path's hasPermission ultimately
//    calls lib/helpers.js's hasCoursePermission/evalCoursePermission, which
//    compares `creatorId === userId` without coercing both sides to the same
//    type (a Mongoose ObjectId is never `===` a string) and so incorrectly
//    denies a non-admin course owner updating their own course — the same
//    bug already worked around for storyboard access above. Going straight
//    to the raw DB (the exact same primitive hasCoursePermission itself uses
//    internally, minus its broken comparison) avoids that failure mode.
async function addCourseShareWithUsers(courseId, userIds) {
  if (!courseId || !Array.isArray(userIds) || !userIds.length) return;
  try {
    const rawDb = await new Promise((resolve, reject) => {
      rawDatabase.getDatabase((err, instance) => (err ? reject(err) : resolve(instance)));
    });
    const course = await new Promise((resolve, reject) => {
      rawDb.retrieve('course', { _id: courseId }, { jsonOnly: true }, (err, results) => {
        if (err) return reject(err);
        resolve(Array.isArray(results) && results.length ? results[0] : null);
      });
    });
    if (!course) return; // course not found — nothing to add to, not fatal
    const existing = Array.isArray(course._shareWithUsers) ? course._shareWithUsers.map(String) : [];
    const merged = Array.from(new Set([...existing, ...userIds.map(String)]));
    if (merged.length === existing.length) return; // nothing new — skip the write
    await new Promise((resolve, reject) => {
      rawDb.update('course', { _id: courseId }, { _shareWithUsers: merged }, (err) => (err ? reject(err) : resolve()));
    });
  } catch (error) {
    console.error('[storyboard] failed to add reviewers to course _shareWithUsers:', error && error.message);
  }
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

// `accessLevel`, when given, is stamped onto the response as
// `_viewerAccessLevel` so the frontend can tell a view+comment-only reviewer
// apart from full edit access and adjust its UI accordingly (read-only
// editor, hidden Save/Import/Share/Generate) instead of rendering the full
// authoring UI and only discovering the restriction when an edit silently
// gets rejected.
function serializeStoryboard(doc, accessLevel) {
  const o = toPlain(doc);
  if (!o) return o;
  return {
    ...o,
    documentJson: safeParse(o.documentJson, []),
    _generatedContentMap: safeParse(o._generatedContentMap, {}),
    ...(accessLevel ? { _viewerAccessLevel: accessLevel } : null),
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
    // No course-level gate here (see getStoryboardAccessLevel's "known gap"
    // comment) — matches pre-existing behaviour, not a new hole: creating a
    // storyboard was never course-gated before this access-control pass.

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
    return res.status(201).json(serializeStoryboard(created, 'edit'));
  } catch (error) {
    return fail(res, error, 'Failed to create storyboard');
  }
}

async function getStoryboardByCourse(req, res) {
  try {
    const { userId } = userCtx(req);
    const results = await db.retrieve('storyboard', { _courseId: req.params.courseId });
    const rec = Array.isArray(results) && results.length ? toPlain(results[0]) : null;
    if (rec) {
      const level = getStoryboardAccessLevel(rec, userId);
      if (!level) return denyStoryboardAccess(res);
      return res.status(200).json(serializeStoryboard(rec, level));
    }
    // No storyboard exists yet for this course — nothing to check access
    // against yet (see getStoryboardAccessLevel's "known gap" comment);
    // matches pre-existing behaviour.
    return res.status(200).json(null);
  } catch (error) {
    return fail(res, error, 'Failed to retrieve storyboard by course');
  }
}

async function getStoryboard(req, res) {
  try {
    const { userId, tenantId } = userCtx(req);
    const { record, level } = await loadStoryboardAccess(req.params.id, userId);
    if (!record) return denyStoryboardAccess(res);
    return res.status(200).json(serializeStoryboard(record, level));
  } catch (error) {
    return fail(res, error, 'Failed to retrieve storyboard');
  }
}

async function updateStoryboard(req, res) {
  try {
    const { userId, tenantId } = userCtx(req);
    const { level } = await loadStoryboardAccess(req.params.id, userId);
    if (level !== 'edit') return denyStoryboardAccess(res);
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
    return res.status(200).json(serializeStoryboard(results[0], 'edit'));
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
    const { record: current, level } = await loadStoryboardAccess(req.params.id, userId);
    if (!current) return denyStoryboardAccess(res);
    if (level !== 'edit') return denyStoryboardAccess(res);
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
    return res.status(200).json(serializeStoryboard(updated[0], 'edit'));
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

    const { record: current, level } = await loadStoryboardAccess(req.params.id, userId);
    if (!current) return denyStoryboardAccess(res);
    // Only edit-level (owner/admin/course-shared) can manage WHO is invited —
    // a reviewer invited for review shouldn't be able to add/remove other
    // reviewers or revoke their own access.
    if (level !== 'edit') return denyStoryboardAccess(res);

    await db.update('storyboard', { _id: req.params.id }, { _shareWithUsers: userIds, updatedBy: userId });
    await db.create('storyboardaudit', {
      _storyboardId: req.params.id,
      _courseId: current._courseId,
      _tenantId: tenantId,
      createdBy: userId,
      event: 'shared',
      meta: JSON.stringify({ userIds }),
    });
    // So an invited reviewer can find/open the course at all — see
    // addCourseShareWithUsers's own comment for why this is additive-only
    // and best-effort (never blocks or fails the storyboard share above).
    await addCourseShareWithUsers(current._courseId, userIds);

    const updated = await db.retrieve('storyboard', { _id: req.params.id });
    return res.status(200).json(serializeStoryboard(updated[0], 'edit'));
  } catch (error) {
    return fail(res, error, 'Failed to share storyboard');
  }
}

async function deleteStoryboard(req, res) {
  try {
    const { userId, tenantId } = userCtx(req);
    const { level } = await loadStoryboardAccess(req.params.id, userId);
    if (level !== 'edit') return denyStoryboardAccess(res);
    await db.destroy('storyboard', { _id: req.params.id });
    return res.status(200).json({ success: true });
  } catch (error) {
    return fail(res, error, 'Failed to delete storyboard');
  }
}

// ── Comments (AC9) ───────────────────────────────────────────────────────────

async function listComments(req, res) {
  try {
    const { userId, tenantId } = userCtx(req);
    const { level } = await loadStoryboardAccess(req.params.id, userId);
    if (!level) return denyStoryboardAccess(res);
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
    const { level } = await loadStoryboardAccess(req.params.id, userId);
    if (!level) return denyStoryboardAccess(res);
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
    const existing = await db.retrieve('storyboardcomment', { _id: req.params.commentId });
    if (!Array.isArray(existing) || !existing.length) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    const existingComment = toPlain(existing[0]);
    const { level } = await loadStoryboardAccess(existingComment._storyboardId, userId);
    if (!level) return denyStoryboardAccess(res);

    const body = req.body || {};
    const delta = { updatedBy: userId };
    if (typeof body.body === 'string') delta.body = body.body;
    if (typeof body.resolved === 'boolean') delta.resolved = body.resolved;

    await db.update('storyboardcomment', { _id: req.params.commentId }, delta);
    const results = await db.retrieve('storyboardcomment', { _id: req.params.commentId });
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
    if (storyboardId) {
      const { level } = await loadStoryboardAccess(storyboardId, userId);
      if (!level) return denyStoryboardAccess(res);
    }
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
    const { userId, tenantId } = userCtx(req);
    // Edit-level only — the audit trail is an authoring/management concern,
    // not something a review-only invitee needs (or should see: it reveals
    // internal history beyond the document content itself).
    const { level } = await loadStoryboardAccess(req.params.id, userId);
    if (level !== 'edit') return denyStoryboardAccess(res);
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
    const { level } = await loadStoryboardAccess(req.params.id, userId);
    if (level !== 'edit') return denyStoryboardAccess(res);
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
    const { userId, tenantId } = userCtx(req);
    const { record: rec, level } = await loadStoryboardAccess(req.params.id, userId);
    if (!level) return denyStoryboardAccess(res);
    // Prefer the course title (passed by the client) so the document heading
    // and filename match the course, not the internal storyboard record title.
    const docTitle = (req.query && req.query.title) || rec.title || 'Storyboard';
    const blocks = safeParse(rec.documentJson, []);
    // Explicit user/tenant context so the asset resolver doesn't depend on
    // process.domain.session surviving through async awaits (ADAPT-3785 image
    // embedding fix).
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
    const { userId, tenantId } = userCtx(req);
    const { record: rec, level } = await loadStoryboardAccess(req.params.id, userId);
    if (!level) return denyStoryboardAccess(res);
    const docTitle = (req.query && req.query.title) || rec.title || 'Storyboard';
    const blocks = safeParse(rec.documentJson, []);
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
