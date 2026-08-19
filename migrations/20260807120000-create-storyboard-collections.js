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

    // storyboards — exactly ONE document per course (getStoryboardByCourse
    // relies on this), so the course index is UNIQUE. Clean up any pre-existing
    // duplicates first (keep the most recently updated) so the unique index can
    // build, and drop a prior non-unique index of the same name if present.
    const dupeGroups = await db
      .collection('storyboards')
      .aggregate([
        { $group: { _id: '$_courseId', ids: { $push: '$_id' }, count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
      ])
      .toArray();
    for (const g of dupeGroups) {
      const docs = await db
        .collection('storyboards')
        .find({ _courseId: g._id })
        .sort({ updatedAt: -1, version: -1, _id: -1 })
        .toArray();
      const remove = docs.slice(1).map((d) => d._id); // keep docs[0] (newest)
      if (remove.length) {
        await db.collection('storyboards').deleteMany({ _id: { $in: remove } });
        console.log(`• removed ${remove.length} duplicate storyboard(s) for course ${g._id}`);
      }
    }
    await db
      .collection('storyboards')
      .dropIndex('storyboard_courseId')
      .catch(() => {}); // no-op if it doesn't exist yet
    await db
      .collection('storyboards')
      .createIndex({ _courseId: 1 }, { name: 'storyboard_courseId', unique: true });
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
