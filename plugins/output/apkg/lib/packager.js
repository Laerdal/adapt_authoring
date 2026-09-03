// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
const archiver = require('archiver');
const fs = require('fs-extra');
const Readable = require('stream').Readable;
const logger = require('../../../../lib/logger');

/**
 * Zips the build folder into a course.apkg, injecting manifest.json at the
 * archive root. Mirrors the archiver usage already established by
 * plugins/output/adapt/publish.js's download.zip step.
 *
 * @param {string} buildFolder - the course's already-built BUILD_FOLDER
 * @param {string} destFile - absolute path to write course.apkg to
 * @param {object} manifestObj - the manifest to embed as manifest.json
 * @param {function(Error, object)} next
 */
function packageApkg(buildFolder, destFile, manifestObj, next) {
  var output = fs.createWriteStream(destFile);
  var archive = archiver('zip');
  var callbackCalled = false;

  function done(error, result) {
    if (callbackCalled) return;
    callbackCalled = true;
    next(error, result);
  }

  output.on('close', function() {
    fs.stat(destFile, function(error, stats) {
      if (error) {
        return done(error);
      }
      done(null, { filename: destFile, size: stats.size });
    });
  });
  archive.on('error', function(error) {
    logger.log('error', 'apkg: failed to package course.apkg: ' + error.message);
    done(error);
  });

  archive.pipe(output);
  archive.glob('**/*', {
    cwd: buildFolder,
    ignore: ['**/manifest.json', '**/selection.json', '**/*.ttf']
  });
  // NB: archiver@3.1.1's append() silently produces a zero-byte entry when
  // given a raw string/Buffer directly - wrapping in a Readable is required
  // for the content to actually land in the archive.
  archive.append(Readable.from([JSON.stringify(manifestObj, undefined, 2)]), { name: 'manifest.json' });
  archive.finalize();
}

module.exports = packageApkg;
