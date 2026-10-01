// REST routes for the storyboard feature (ADAPT-3779, AC8/AC9).
// All under /api/storyboard/* (rest prefixes /api). Sub-paths chosen to avoid
// collision with the legacy output/storyboard plugin (word/zip/import/...).

const rest = require('../../../../lib/rest');
const h = require('./requestHandlers');

class Routes {
  constructor() {
    this.register();
  }

  register() {
    // ── Storyboard documents ──────────────────────────────────────────────
    rest.post('/storyboard/documents', h.createStoryboard);
    // `/course/:courseId` uses a literal segment so it never clashes with `/:id`.
    rest.get('/storyboard/documents/course/:courseId', h.getStoryboardByCourse);
    rest.get('/storyboard/documents/:id', h.getStoryboard);
    rest.put('/storyboard/documents/:id', h.updateStoryboard);
    rest.put('/storyboard/documents/:id/status', h.setStoryboardStatus);
    rest.put('/storyboard/documents/:id/share', h.shareStoryboard);
    rest.delete('/storyboard/documents/:id', h.deleteStoryboard);

    // ── Comments (AC9) ────────────────────────────────────────────────────
    rest.get('/storyboard/documents/:id/comments', h.listComments);
    rest.post('/storyboard/documents/:id/comments', h.addComment);
    rest.put('/storyboard/comments/:commentId', h.updateComment);
    rest.delete('/storyboard/comments/:commentId', h.deleteComment);

    // ── Audit trail (AC8) — append-only, no update/delete ─────────────────
    rest.get('/storyboard/documents/:id/audit', h.listAudit);
    rest.post('/storyboard/documents/:id/audit', h.addAudit);

    // ── AI assistance (AC7) — server-side proxy ───────────────────────────
    rest.post('/storyboard/ai', h.handleAi);

    // ── Import / Export (AC10) ────────────────────────────────────────────
    rest.get('/storyboard/documents/:id/export/word', h.exportWord);
    rest.get('/storyboard/documents/:id/export/pdf', h.exportPdf);
    // Under /documents, NOT bare /storyboard/import/:format — the legacy
    // plugins/output/storyboard plugin also registers `/storyboard/import/
    // :courseid`, an identical Express route shape (both are just a single
    // param segment), so whichever plugin's route happened to register first
    // silently swallowed every import request meant for this handler (see
    // the collision note in ../index.js).
    rest.post('/storyboard/documents/import/:format', h.importDocument);
  }
}

exports = module.exports = Routes;
