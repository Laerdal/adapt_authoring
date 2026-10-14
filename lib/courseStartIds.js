const { promisify } = require('util');

module.exports = async function updateCourseStartIds(db, courseId, idMap) {
  const retrieve = promisify(db.retrieve.bind(db));
  const update = promisify(db.update.bind(db));
  const courses = await retrieve('course', { _id: courseId });
  if (!courses.length) throw new Error('Course not found');

  const course = courses[0].toObject();
  if (!course._start || !Array.isArray(course._start._startIds)) return;

  const unresolved = course._start._startIds.filter(entry =>
    !idMap[entry._id] && /^[a-f\d]{24}$/i.test(String(entry._id))
  );
  const resolvedIds = { ...idMap };
  if (unresolved.length) {
    const pages = await retrieve('contentobject', { _courseId: courseId, _type: 'page' });
    const pageIds = pages.map(page => String(page._id));
    for (const entry of unresolved) {
      const oldId = String(entry._id);
      if (pageIds.includes(oldId)) continue;
      if (pageIds.length !== 1) {
        throw new Error(`Cannot resolve start ID '${oldId}' for course '${courseId}'. Select a valid start page in Start settings.`);
      }
      resolvedIds[oldId] = pageIds[0];
    }
  }

  const start = {
    ...course._start,
    _startIds: course._start._startIds.map(entry => ({
      ...entry,
      _id: resolvedIds[entry._id] ? String(resolvedIds[entry._id]) : entry._id
    }))
  };
  await update('course', { _id: courseId }, { _start: start });
};