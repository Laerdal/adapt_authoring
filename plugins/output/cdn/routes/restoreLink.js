// external
const util = require('util');
const exec = util.promisify(require('child_process').exec);

async function restoreLink(groupName, courseName, cdnid, versionFolder) {
    // Note: a promisified exec() only ever resolves with { stdout, stderr } on
    // a zero exit code, or rejects (which the outer catch below propagates) on
    // failure — it never resolves with an `error` field. Non-empty stderr is
    // not itself a failure signal (the underlying CLI/azcopy can write
    // warnings there on success), so only a genuine rejection is treated as
    // an error here.
    const { stdout } = await exec(
        `cdndeploy mv --groupid=${groupName} --courseid=${courseName} --cdnid=${cdnid} --versionfolder=${versionFolder}`
    );

    return JSON.parse(stdout);
}

module.exports = restoreLink;