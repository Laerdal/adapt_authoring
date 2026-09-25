const origin = require('../../../');

// Reuses the app's single pooled Mongoose connection instead of opening a new
// MongoClient (with its own TLS handshake) on every call. This also fixes a
// latent bug: mongoose@5.8.13 bundles its own nested mongodb/bson, separate
// from the top-level mongodb driver. A fresh top-level MongoClient
// serializing an _id produced by mongoose's bundled (older) bson throws
// "Unsupported BSON version" - reusing app.db.conn.db keeps every read/write
// on the same bson family as the ids it's given.
function getDB() {
  return origin().db.conn.db;
}

// No-op: this module no longer owns a connection - the app's pooled
// connection is closed by the app itself, not by individual callers.
function closeDB() {}

module.exports = {
  getDB,
  closeDB,
};
