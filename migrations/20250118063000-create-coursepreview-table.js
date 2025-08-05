/**
 * Migration to create coursepreview table for storing preview timing analytics
 */

exports.up = function(db, callback) {
  console.log('Creating coursepreview collection...');
  
  // Create the coursepreview collection
  db.createCollection('coursepreview', function(err) {
    if (err) {
      console.log('Error creating coursepreview collection:', err);
      return callback(err);
    }
    
    console.log('coursepreview collection created successfully');
    
    // Create index on courseId for faster lookups
    db.collection('coursepreview').createIndex({ courseId: 1 }, { unique: true }, function(err) {
      if (err) {
        console.log('Error creating index on courseId:', err);
        return callback(err);
      }
      
      console.log('Index created on courseId field');
      callback();
    });
  });
};

exports.down = function(db, callback) {
  console.log('Dropping coursepreview collection...');
  
  db.collection('coursepreview').drop(function(err) {
    if (err && err.code !== 26) { // 26 = NamespaceNotFound (collection doesn't exist)
      console.log('Error dropping coursepreview collection:', err);
      return callback(err);
    }
    
    console.log('coursepreview collection dropped successfully');
    callback();
  });
};
