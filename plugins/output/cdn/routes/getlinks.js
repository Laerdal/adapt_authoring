// external
const util = require('util');
const exec = util.promisify(require('child_process').exec);
// internal
const log = require('../utils/logger');

async function getLinks(groupName, courseName, cdnId) {
  try {
    const { stdout } = await exec(
      `cdndeploy ls --groupid=${groupName} --courseid=${courseName} --cdnid=${cdnId}`
    );

    return JSON.parse(stdout);
  } catch (error) {
    // `cdndeploy ls` exits non-zero (or writes to stderr, e.g. azcopy CLI
    // warnings) whenever a group/course has no previous deployments yet, or
    // storage listing is momentarily inconsistent right after an upload.
    // That's an expected, non-fatal state for this UI (a fresh/just-deployed
    // course), not a server error — log it but respond with an empty list
    // rather than 500ing the CDN Deployment page.
    log.warn(`[cdn] getLinks found nothing for ${groupName}/${courseName}/${cdnId}: ${error.message}`);
    return [];
  }
}

module.exports = getLinks;
