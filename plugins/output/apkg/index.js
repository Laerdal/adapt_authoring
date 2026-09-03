// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
const OutputPlugin = require('../../../lib/outputmanager').OutputPlugin;
const util = require('util');

/**
 * Offline Package (.apkg) output plugin.
 *
 * Reuses the core 'adapt' output plugin to perform the actual Adapt
 * Framework build, then post-processes the resulting build folder into a
 * self-describing offline package (course.apkg). See publish.js.
 */
function ApkgOutput() {
}
util.inherits(ApkgOutput, OutputPlugin);

ApkgOutput.prototype.publish = require('./publish');

exports = module.exports = ApkgOutput;
