// Promisified CRUD wrappers over the content manager, scoped to the current
// request's tenant/user (the content manager resolves tenant from the session
// user). Mirrors plugins/content/templating/utils/database.js.

const app = require('../../../../')();

function create(type, data) {
  return new Promise((resolve, reject) => {
    app.contentmanager.create(type, data, (err, result) => (err ? reject(err) : resolve(result)));
  });
}

function retrieve(type, search, options) {
  return new Promise((resolve, reject) => {
    app.contentmanager.retrieve(type, search, options || {}, (err, results) =>
      err ? reject(err) : resolve(results)
    );
  });
}

function update(type, search, delta) {
  return new Promise((resolve, reject) => {
    app.contentmanager.update(type, search, delta, (err, result) => (err ? reject(err) : resolve(result)));
  });
}

// force=false so the content plugin's hasPermission gates the delete (see
// ContentPlugin.destroy in lib/contentmanager.js). We do NOT hard-bypass
// permissions here — the storyboard plugins currently allow the action, and
// when real ownership/course-scoped checks land they'll be enforced.
function destroy(type, search) {
  return new Promise((resolve, reject) => {
    app.contentmanager.destroy(type, search, false, (err) => (err ? reject(err) : resolve()));
  });
}

module.exports = { create, retrieve, update, destroy };
