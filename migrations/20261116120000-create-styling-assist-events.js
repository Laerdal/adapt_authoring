/**
 * Migration: Create styling-assist telemetry collection
 *
 * Additive only. Backs the Samaritan styling help feature (Technical Settings
 * -> Custom CSS). Documents hold the raw intent (trimmed to 500 chars), NO user
 * id, and are flagged trainingUse:false. Collection name matches the plugin's
 * `stylingassistevents` constant.
 *
 * Non-destructive: up() only creates (guarded by an existence check).
 * Rollback (down) drops the collection, guarded with .catch().
 */

const COLLECTION = 'stylingassistevents';

module.exports = {
  async up(db) {
    const existing = (await db.listCollections().toArray()).map((c) => c.name);
    if (existing.includes(COLLECTION)) {
      console.log(`• ${COLLECTION} already exists — leaving as is`);
    } else {
      await db.createCollection(COLLECTION);
      console.log(`✓ created collection ${COLLECTION}`);
    }

    // Outcome updates look up by requestId (unique per request).
    await db.collection(COLLECTION).createIndex({ requestId: 1 }, { name: 'stylingassist_requestId', unique: true });
    // Analytics aggregation is range-filtered by createdAt.
    await db.collection(COLLECTION).createIndex({ createdAt: -1 }, { name: 'stylingassist_createdAt' });
    await db
      .collection(COLLECTION)
      .createIndex({ resolutionType: 1, createdAt: -1 }, { name: 'stylingassist_resolutionType_createdAt' });

    console.log('✓ styling-assist collection + indexes created');
    return { collections: [COLLECTION] };
  },

  async down(db) {
    await db
      .collection(COLLECTION)
      .drop()
      .then(() => console.log(`✓ dropped ${COLLECTION}`))
      .catch((err) => console.log(`• ${COLLECTION} not dropped: ${err.message}`));
    return { collections: [COLLECTION], action: 'dropped' };
  },
};
