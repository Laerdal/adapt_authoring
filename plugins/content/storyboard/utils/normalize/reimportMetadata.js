// Embeds/reads a small hidden marker in exported .docx files so a later
// re-import can detect "this file came from Storyboard export" (ADAPT-3760
// re-import, spec §2). Not a new export feature — a targeted addition to the
// existing blocksToDocx output. Stored as a genuine OOXML custom document
// property (docProps/custom.xml), which the `docx` package already supports
// writing natively; read back via `adm-zip` (already a dependency) since
// Mammoth's HTML conversion doesn't expose document-level custom properties.

const AdmZip = require('adm-zip');

const CUSTOM_PROPERTY_NAME = 'AdaptStoryboardMeta';
const EXPORT_SCHEMA_VERSION = 1;

/**
 * Build the `customProperties` array to pass into `docx`'s `Document`
 * constructor so the exported file carries a courseId/storyboardId + schema
 * version. `courseId` is the primary identifier re-import/content-only-update
 * keys off (ADAPT-3760 import enhancements) — `storyboardId` is kept too for
 * any future need to key off the storyboard record specifically.
 * @param {{ courseId?: string, storyboardId?: string }} meta
 * @returns {Array<{name:string,value:string}>}
 */
function buildCustomProperties(meta) {
  if (!meta || (!meta.courseId && !meta.storyboardId)) return [];
  const value = JSON.stringify({
    courseId: meta.courseId ? String(meta.courseId) : undefined,
    storyboardId: meta.storyboardId ? String(meta.storyboardId) : undefined,
    schemaVersion: EXPORT_SCHEMA_VERSION,
  });
  return [{ name: CUSTOM_PROPERTY_NAME, value }];
}

/**
 * Read the marker back out of an uploaded .docx buffer, if present and
 * well-formed. Returns null on any parse failure — a missing/invalid marker
 * must never fail the import, only skip re-import detection (spec §2).
 * @param {Buffer} buffer
 * @returns {{ courseId?: string, storyboardId?: string, schemaVersion: number } | null}
 */
function readDocxMetadata(buffer) {
  try {
    const zip = new AdmZip(buffer);
    const entry = zip.getEntry('docProps/custom.xml');
    if (!entry) return null;
    const xml = entry.getData().toString('utf8');
    const re = new RegExp(
      `<property[^>]*name="${CUSTOM_PROPERTY_NAME}"[^>]*>\\s*<vt:lpwstr>([\\s\\S]*?)</vt:lpwstr>`,
    );
    const match = re.exec(xml);
    if (!match) return null;
    const decoded = match[1]
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
    const parsed = JSON.parse(decoded);
    if (!parsed || (!parsed.courseId && !parsed.storyboardId)) return null;
    return {
      courseId: typeof parsed.courseId === 'string' ? parsed.courseId : undefined,
      storyboardId: typeof parsed.storyboardId === 'string' ? parsed.storyboardId : undefined,
      schemaVersion: Number(parsed.schemaVersion) || 1,
    };
  } catch (e) {
    return null;
  }
}

module.exports = { buildCustomProperties, readDocxMetadata, EXPORT_SCHEMA_VERSION };
