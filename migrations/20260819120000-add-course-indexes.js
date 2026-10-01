/**
 * Migration to add indexes on the `courses` collection for course-listing performance.
 *
 * The dashboard/course-listing endpoints (/my/course, /shared/course in
 * plugins/content/course/index.js) filter on `createdBy`, `_shareWithUsers`,
 * `_isShared`, and are tenant-scoped by `_tenantId` — but the `courses` collection
 * had no index on any of these. Every listing was therefore a full collection scan,
 * which surfaced as the "*** QUERY TIMEOUT - CourseContent.retrieve is taking too
 * long ***" log flood once the collection grew (many test courses). These indexes
 * turn those scans into index lookups.
 *
 * Companion to 20260309120000-add-content-indexes.js, which indexed the content tree
 * (articles/blocks/components/contentobjects) but NOT the courses collection.
 *
 * Mongoose auto-pluralises 'course' -> 'courses'; index the plural (real) collection.
 */
const COURSES_COLLECTION = 'courses';

const INDEXES = [
  { key: { _tenantId: 1 },                name: 'idx_courses_tenantId' },
  { key: { createdBy: 1 },                name: 'idx_courses_createdBy' },
  { key: { _shareWithUsers: 1 },          name: 'idx_courses_shareWithUsers' },
  { key: { _isShared: 1 },                name: 'idx_courses_isShared' },
  { key: { _tenantId: 1, createdBy: 1 },  name: 'idx_courses_tenantId_createdBy' }
];

exports.up = function(db, callback) {
  const async = require('async');
  const collection = db.collection(COURSES_COLLECTION);
  console.log('Creating indexes on the courses collection for listing performance...');

  async.eachSeries(INDEXES, function(ix, next) {
    collection.createIndex(ix.key, { name: ix.name, background: true }, function(err) {
      if (err && err.code !== 85) { // 85 = index already exists
        console.log('Error creating ' + ix.name + ' on courses:', err);
        return next(err);
      }
      console.log('  - Created ' + ix.name + ' on courses');
      next();
    });
  }, function(err) {
    if (err) {
      console.log('Migration failed:', err);
      return callback(err);
    }
    console.log('All courses indexes created successfully');
    callback();
  });
};

exports.down = function(db, callback) {
  const async = require('async');
  const collection = db.collection(COURSES_COLLECTION);
  console.log('Removing courses collection indexes...');

  async.eachSeries(INDEXES, function(ix, next) {
    collection.dropIndex(ix.name, function(err) {
      if (err && err.code !== 27) { // 27 = index not found
        return next(err);
      }
      next();
    });
  }, function(err) {
    if (err) {
      console.log('Migration rollback failed:', err);
      return callback(err);
    }
    console.log('All courses indexes removed successfully');
    callback();
  });
};
