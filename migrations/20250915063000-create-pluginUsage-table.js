/**
 * Migration to create authoringplugins table for storing preview timing analytics
 */

exports.up = function(db, callback) {
  console.log('Creating authoringplugins collection...');

  // Create the authoringplugins collection
  db.createCollection('authoringplugins', function(err) {
    if (err) {
      console.log('Error creating authoringplugins collection:', err);
      return callback(err);
    }

    console.log('authoringplugins collection created successfully');

    // Create index on pluginType for faster lookups
    db.collection('authoringplugins').createIndex({ pluginType: 1 }, { unique: true }, function(err) {
      if (err) {
        console.log('Error creating index on pluginType:', err);
        return callback(err);
      }

      console.log('Index created on pluginType field');
      callback();
    });
  });
};

exports.down = function(db, callback) {
  console.log('Dropping authoringplugins collection...');

  db.collection('authoringplugins').drop(function(err) {
    if (err && err.code !== 26) { // 26 = NamespaceNotFound (collection doesn't exist)
      console.log('Error dropping authoringplugins collection:', err);
      return callback(err);
    }

    console.log('authoringplugins collection dropped successfully');
    callback();
  });
};
