const _ = require('underscore');
const { getContentFromDatabase } = require('./database');
const database = require('../../../../lib/database');
const log = require('./logger');
const { orderBlockComponents } = require('../../../../lib/componentLayoutOrder');

// Get access to the application instance
const origin = require('../../../../');

async function getDB() {
  return new Promise((resolve, reject) => {
    database.getDatabase((err, db) => {
      if (err) reject(err);
      resolve(db);
    });
  });
}

async function getCourseJSON(courseId) {
  try {
    const courseJSON = await getContentFromDatabase(courseId);

    courseJSON.sortContentObjects = sortContentObjects(
      courseJSON.contentObjects
    );

    courseJSON.contentObjects.forEach((co) => addChildren(co, courseJSON));
    courseJSON.articles.forEach((article) => addChildren(article, courseJSON));
    courseJSON.blocks.forEach((block) => addChildren(block, courseJSON));

    return courseJSON;
  } catch (error) {
    log.error('Problem getting course json:');
    throw error;
  }
}

/**
 * Sort contentObjects into correct creation order.
 * (Parent Menus must be created before child Menus/Pages)
 * @param {array} data
 * @param {callback} cb
 */
function sortContentObjects(data) {
  let flat = {},
    root = [],
    list = [],
    counter = 0;

  // Flatten the data
  for (const item of data) {
    const key = item._id;

    flat[key] = {
      _id: item._id,
      _parentId: item._parentId,
      children: [],
    };
  }

  // Populate any 'children' container arrays
  for (let i in flat) {
    const parentkey = flat[i]._parentId;

    if (flat[parentkey]) {
      flat[parentkey].children.push(flat[i]);
    }
  }

  // Find the root nodes (no parent found) and create the hierarchy tree from them
  for (let i in flat) {
    const parentkey = flat[i]._parentId;

    if (!flat[parentkey]) {
      root.push(flat[i]);
    }
  }

  for (const i in root) {
    appendToItems(list, root[i], counter);
  }

  for (const item of data) {
    item._createOrder = list[item._id]._createOrder;
  }

  // Sort items according to creation order
  data.sort(function (a, b) {
    return a._createOrder - b._createOrder;
  });

  return data;
}

/**
 * Recursive append item to list (and set creation order)
 * @param {array} list
 * @param {object} item
 * @param {int} counter
 */
function appendToItems(list, item, counter) {
  counter++;
  item._createOrder = counter;
  list[item._id] = item;

  if (item.children) {
    for (const i in item.children) {
      appendToItems(list, item.children[i], counter);
    }
  }
}

async function createCourseJSONFiles(courseId) {
  // TODO: ensure file exists, then write
  try {
    const courseJson = await getCourseJSON(courseId);
    await writeCourseJSON(courseJson, courseId);
  } catch (error) {
    log.error('Problem creating course json files:', error);
    throw error;
  }
}

function addChildren(content, courseJSON) {
  if (!content) return;

  switch (content._type) {
    case 'menu':
      content._children = getSortedChildren(
        'contentObjects',
        content._id,
        courseJSON
      );
      break;
    case 'page':
      content._children = getSortedChildren(
        'articles',
        content._id,
        courseJSON
      );
      break;
    case 'article':
      content._children = getSortedChildren('blocks', content._id, courseJSON);
      break;
    case 'block':
      content._children = getSortedChildren(
        'components',
        content._id,
        courseJSON
      );
      break;
  }
}

function getSortedChildren(type, id, courseJSON) {
  let children = _.where(courseJSON[type], {
    _parentId: id,
  });
  const sorted = _.sortBy(children, '_sortOrder');
  return type === 'components' ? orderBlockComponents(sorted) : sorted;
}

exports.createCourseJSONFiles = createCourseJSONFiles;
exports.getCourseJSON = getCourseJSON;

/**
 * Update a specific content item in the database
 * @param {string} itemId - The item ID
 * @param {Object} updatedData - Updated item data
 * @returns {Object} Update result
 */
async function updateCourseContent(itemId, updatedData) {
  try {
    log.info(`=== UPDATING DATABASE ITEM - HYBRID APPROACH ===`);
    log.info(`Item ID: ${itemId}`);
    log.info(`Item type: ${updatedData._type}`);
    log.info(`Updated fields: ${Object.keys(updatedData).join(', ')}`);
    
    // First, let's get the current item to see what we're working with
    const db = await getDB();
    const currentItems = await new Promise((resolve, reject) => {
      db.retrieve(updatedData._type, { _id: itemId }, (err, items) => {
        if (err) reject(err);
        else resolve(items);
      });
    });
    
    if (!currentItems || currentItems.length === 0) {
      log.error(`❌ Item ${itemId} not found in database!`);
      throw new Error(`Item ${itemId} not found`);
    }
    
    const currentItem = currentItems[0];
    log.info(`📋 BEFORE UPDATE - Current item state:`);
    log.info(`  displayTitle: "${currentItem.displayTitle}"`);
    log.info(`  body: "${(currentItem.body || '').substring(0, 100)}..."`);
    log.info(`  instruction: "${(currentItem.instruction || '').substring(0, 100)}..."`);
    log.info(`  _updatedAt: ${currentItem._updatedAt}`);
    
    // Prepare update data (remove _id to avoid conflicts)
    const updateData = { ...updatedData };
    delete updateData._id;
    
    // Add required metadata fields for updates
    updateData._updatedAt = new Date();
    if (!updateData._updatedBy) {
      updateData._updatedBy = 'storyboard-import';
    }
    
    log.info(`📝 UPDATE DATA being applied:`);
    if (updateData.displayTitle) {
      log.info(`  NEW displayTitle: "${updateData.displayTitle}"`);
    }
    if (updateData.body) {
      log.info(`  NEW body: "${updateData.body.substring(0, 100)}..."`);
    }
    if (updateData.instruction) {
      log.info(`  NEW instruction: "${updateData.instruction.substring(0, 100)}..."`);
    }
    
    // Try ContentManager first
    let result;
    try {
      const app = origin();
      if (app && app.contentmanager) {
        log.info(`🔄 Attempting update via ContentManager...`);
        result = await new Promise((resolve, reject) => {
          app.contentmanager.update(updatedData._type, { _id: itemId }, updateData, (updateErr, result) => {
            if (updateErr) {
              log.error(`❌ ContentManager update failed:`, updateErr);
              reject(updateErr);
            } else {
              log.info(`✅ ContentManager update completed`);
              resolve(result);
            }
          });
        });
      } else {
        throw new Error('ContentManager not available');
      }
    } catch (cmError) {
      log.warn(`⚠️ ContentManager failed, trying direct database update:`, cmError);
      
      // Fallback to direct database update
      result = await new Promise((resolve, reject) => {
        db.update(updatedData._type, { _id: itemId }, updateData, (updateErr, result) => {
          if (updateErr) {
            log.error(`❌ Direct database update failed:`, updateErr);
            reject(updateErr);
          } else {
            log.info(`✅ Direct database update completed`);
            resolve(result);
          }
        });
      });
    }
    
    // Force a delay to ensure database operations complete
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Verify the update
    const verificationItems = await new Promise((resolve, reject) => {
      db.retrieve(updatedData._type, { _id: itemId }, (err, items) => {
        if (err) reject(err);
        else resolve(items);
      });
    });
    
    if (verificationItems && verificationItems.length > 0) {
      const verifiedItem = verificationItems[0];
      log.info(`📋 AFTER UPDATE - Verified item state:`);
      log.info(`  displayTitle: "${verifiedItem.displayTitle}"`);
      log.info(`  body: "${(verifiedItem.body || '').substring(0, 100)}..."`);
      log.info(`  instruction: "${(verifiedItem.instruction || '').substring(0, 100)}..."`);
      log.info(`  _updatedAt: ${verifiedItem._updatedAt}`);
      
      // Check if the changes actually took effect
      let changesApplied = false;
      if (updateData.displayTitle && verifiedItem.displayTitle === updateData.displayTitle) {
        log.info(`✅ displayTitle change verified`);
        changesApplied = true;
      }
      if (updateData.body && verifiedItem.body === updateData.body) {
        log.info(`✅ body change verified`);
        changesApplied = true;
      }
      if (updateData.instruction && verifiedItem.instruction === updateData.instruction) {
        log.info(`✅ instruction change verified`);
        changesApplied = true;
      }
      
      if (!changesApplied) {
        log.error(`❌ CRITICAL: Changes were not applied to the database!`);
        log.error(`Expected vs Actual:`);
        if (updateData.displayTitle) {
          log.error(`  Title - Expected: "${updateData.displayTitle}" | Actual: "${verifiedItem.displayTitle}"`);
        }
        if (updateData.body) {
          log.error(`  Body - Expected length: ${updateData.body.length} | Actual length: ${(verifiedItem.body || '').length}`);
        }
      } else {
        log.info(`✅ All changes verified in database`);
        
        // CRITICAL: Emit events to notify other parts of the system
        try {
          const app = origin();
          if (app && app.contentmanager) {
            // Emit update events for the specific content type
            log.info(`📢 Emitting update events for ${updatedData._type}`);
            app.contentmanager.emit(`${updatedData._type}:updated`, {
              _id: itemId,
              _type: updatedData._type,
              ...updateData
            });
            
            // Also emit general content updated event
            app.contentmanager.emit('content:updated', {
              _id: itemId,
              _type: updatedData._type,
              _courseId: verifiedItem._courseId
            });
            
            log.info(`✅ Update events emitted successfully`);
            
            // Invalidate any caches related to this content
            if (app.contentmanager.cache) {
              app.contentmanager.cache.clear();
              log.info(`🗑️ ContentManager cache cleared`);
            }
          }
        } catch (eventError) {
          log.warn('Failed to emit update events:', eventError);
        }
      }
    } else {
      log.error(`❌ Could not verify update - item not found after update`);
    }
    
    log.info(`✓ Update process completed for ${updatedData._type} item: ${itemId}`);
    return result;
    
  } catch (error) {
    log.error(`❌ Error updating course content:`, error);
    throw error;
  }
}

exports.updateCourseContent = updateCourseContent;
