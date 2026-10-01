// external
const util = require('util');
const exec = util.promisify(require('child_process').exec);

async function getVersion() {
  // A promisified exec() only ever resolves with { stdout, stderr } on a zero
  // exit code, or rejects (propagated below) on failure — it never resolves
  // with an `error` field. Non-empty stderr on its own isn't a failure signal
  // (the CLI can write warnings there on success), so only a genuine
  // rejection is treated as an error here — same fix as getlinks.js/restoreLink.js.
  //
  // Use `-version` (matches the presence check in routes/health/index.js) and
  // trim so the UI doesn't render a trailing newline.
  const { stdout } = await exec('cdndeploy -version');
  return stdout.trim();
}

module.exports = getVersion;
