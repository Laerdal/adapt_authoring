/**
 * Migration: disable-deprecated-plugins
 *
 * Ensures deprecated plugins are permanently locked in the DB and removes
 * any references to them (or orphaned/missing plugins) from existing course
 * config documents so that builds do not fail.
 *
 * Safe to re-run: all operations are idempotent.
 */

const DEPRECATED_BY_TYPE = {
  extension: ['adapt-laerdal-branching', 'adapt-inline-feedback', 'adapt-laerdal-spoor'],
  component: [],
  theme: [],
  menu: []
};

module.exports = {
  async up(db) {
    // Step 1: lock _isAvailableInEditor on every deprecated plugin record
    for (const [type, names] of Object.entries(DEPRECATED_BY_TYPE)) {
      if (!names.length) continue;
      const collection = `${type}type`;
      await db.collection(collection).updateMany(
        { name: { $in: names } },
        { $set: { _isAvailableInEditor: false } }
      );
    }

    // Step 2: for each extension in DEPRECATED_BY_TYPE.extension, find its
    // 'extension' field value (the key used in _enabledExtensions) then
    // $unset it from every config document that carries it.
    const extensionCollection = db.collection('extensiontype');
    const configCollection = db.collection('config');

    const deprecatedExtNames = DEPRECATED_BY_TYPE.extension;

    // Collect all installed deprecated extension records to get their field keys
    const installedDeprecated = await extensionCollection
      .find({ name: { $in: deprecatedExtNames } })
      .toArray();

    // Build an $unset map for keys we know about from the DB record
    const unsetKnown = {};
    installedDeprecated.forEach(function(ext) {
      if (ext.extension) {
        unsetKnown[`_enabledExtensions.${ext.extension}`] = '';
      }
    });

    if (Object.keys(unsetKnown).length > 0) {
      await configCollection.updateMany({}, { $unset: unsetKnown });
    }

    // Step 3: orphan cleanup — remove any _enabledExtensions entry whose
    // extensiontype record no longer exists in the DB (covers adapt-laerdal-spoor
    // and any other plugin removed without a prior cleanup).
    const allExtensionTypes = await extensionCollection.find({}, { projection: { _id: 1 } }).toArray();
    const validIds = new Set(allExtensionTypes.map(e => e._id.toString()));

    const configDocs = await configCollection.find(
      { _enabledExtensions: { $exists: true } },
      { projection: { _id: 1, _enabledExtensions: 1 } }
    ).toArray();

    for (const doc of configDocs) {
      const orphanedKeys = Object.entries(doc._enabledExtensions || {})
        .filter(([, val]) => val && val._id && !validIds.has(val._id.toString()))
        .map(([key]) => key);

      if (orphanedKeys.length > 0) {
        const unsetOrphans = {};
        orphanedKeys.forEach(function(key) { unsetOrphans[`_enabledExtensions.${key}`] = ''; });
        await configCollection.updateOne({ _id: doc._id }, { $unset: unsetOrphans });
      }
    }
  },

  async down(db) {
    // Re-enable is intentionally not supported — deprecation is permanent.
    // To undo, manually set _isAvailableInEditor: true via the admin account.
  }
};
