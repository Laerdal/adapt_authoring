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

// force=true skips the (course) permission pre-check; access is already gated
// by the route's own auth. The dispatch layer forwards (search, force, cb) to
// the plugin's destroy(search, force, next).
function destroy(type, search) {
  return new Promise((resolve, reject) => {
    app.contentmanager.destroy(type, search, true, (err) => (err ? reject(err) : resolve()));
  });
}

module.exports = { create, retrieve, update, destroy };
