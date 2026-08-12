/**
 * Migration: Create storyboard collections (ADAPT-3779, Phase 1)
 *
 * Additive only — creates the three collections backing the Storyboard
 * Authoring feature and their indexes. Collection names match Mongoose's
 * pluralised model names (model 'storyboard' → collection 'storyboards', etc.)
 * so the app and the migration agree.
 *
 *   storyboards         — one document per course (documentJson, status, version,
 *                         _generatedContentMap)                            (AC8)
 *   storyboardcomments  — block-anchored comments + threaded replies       (AC9)
 *   storyboardaudits    — append-only workflow event trail                 (AC8)
 *
 * Non-destructive: up() only creates (guarded by an existence check) and never
 * drops. Rollback (down) drops the three collections, guarded with .catch().
 */

const COLLECTIONS = ['storyboards', 'storyboardcomments', 'storyboardaudits'];

module.exports = {
  async up(db) {
    const existing = (await db.listCollections().toArray()).map((c) => c.name);

    async function ensureCollection(name) {
      if (existing.includes(name)) {
        console.log(`• ${name} already exists — leaving as is`);
        return;
      }
      await db.createCollection(name);
      console.log(`✓ created collection ${name}`);
    }

    for (const name of COLLECTIONS) {
      await ensureCollection(name);
    }

    // storyboards — looked up by course; filtered by status.
    await db.collection('storyboards').createIndex({ _courseId: 1 }, { name: 'storyboard_courseId' });
    await db.collection('storyboards').createIndex({ status: 1 }, { name: 'storyboard_status' });

    // storyboardcomments — listed per storyboard; filtered by resolved; threaded.
    await db
      .collection('storyboardcomments')
      .createIndex({ _storyboardId: 1 }, { name: 'comment_storyboardId' });
    await db
      .collection('storyboardcomments')
      .createIndex({ _storyboardId: 1, resolved: 1 }, { name: 'comment_storyboard_resolved' });
    await db
      .collection('storyboardcomments')
      .createIndex({ _parentCommentId: 1 }, { name: 'comment_parent' });

    // storyboardaudits — listed per storyboard, newest first.
    await db
      .collection('storyboardaudits')
      .createIndex({ _storyboardId: 1, createdAt: -1 }, { name: 'audit_storyboard_createdAt' });

    console.log('✓ storyboard collections + indexes created');
    return { collections: COLLECTIONS };
  },

  async down(db) {
    for (const name of COLLECTIONS) {
      await db
        .collection(name)
        .drop()
        .then(() => console.log(`✓ dropped ${name}`))
        .catch((err) => console.log(`• ${name} not dropped: ${err.message}`));
    }
    return { collections: COLLECTIONS, action: 'dropped' };
  },
};
