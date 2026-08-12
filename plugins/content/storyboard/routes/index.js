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
    rest.post('/storyboard/import/:format', h.importDocument);
  }
}

exports = module.exports = Routes;
