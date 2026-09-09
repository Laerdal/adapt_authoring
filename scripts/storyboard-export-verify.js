// Local end-to-end verification for the Storyboard Word export.
//
// Bypasses the HTTP route (no auth needed) by pulling the storyboard record
// directly from Mongo and running it through the same converter used by the
// export endpoint. Writes the .docx + a text-only extract we can grep to
// verify content parity against the reference document.
//
// Usage:
//   node scripts/storyboard-export-verify.js <storyboardId?>
//
// If <storyboardId> is omitted, the most-recently-updated storyboard is used.

/* eslint-disable no-console */
const path = require('path');
const fs = require('fs');
const { MongoClient, ObjectId } = require('mongodb');

// Load the same config used by the running server.
const cfg = require('../conf/config.json');
// Also bootstrap Adapt's configuration singleton so the asset resolver (which
// reads dataRoot, masterTenantName, masterTenantID from it) has real values.
const configuration = require('../lib/configuration');
Object.entries(cfg).forEach(([k, v]) => configuration.setConfig(k, v));
const convert = require('../plugins/content/storyboard/utils/documentConvert');

async function main() {
  const wantId = process.argv[2] || null;
  const url = `mongodb://${cfg.dbHost}:${cfg.dbPort}`;
  const client = new MongoClient(url);
  await client.connect();
  const db = client.db(cfg.dbName);

  const query = wantId ? { _id: new ObjectId(wantId) } : {};
  const sort = { updatedAt: -1, createdAt: -1 };
  const rec = await db.collection('storyboards').findOne(query, { sort });
  if (!rec) throw new Error('No storyboard found in Mongo.');
  console.log('Storyboard', rec._id.toString(), 'title=', rec.title, 'course=', rec._courseId && rec._courseId.toString());

  // The course is scoped to a tenant. Look it up so we can pass the correct
  // ctx to the converter (needed for asset lookups).
  const course = rec._courseId
    ? await db.collection('courses').findOne({ _id: new ObjectId(rec._courseId) })
    : null;
  const tenantId = (rec._tenantId && rec._tenantId.toString()) ||
    (course && course._tenantId && course._tenantId.toString()) ||
    null;

  await client.close();

  // Resolve documentJson (stored as a JSON string) into a blocks array.
  let blocks = [];
  if (typeof rec.documentJson === 'string') {
    try { blocks = JSON.parse(rec.documentJson); } catch (e) { blocks = []; }
  } else if (Array.isArray(rec.documentJson)) {
    blocks = rec.documentJson;
  }
  console.log('Blocks:', blocks.length);

  const docTitle = (course && course.title) || rec.title || 'Storyboard';
  const ctx = { tenantId };
  const buffer = await convert.blocksToDocx(blocks, docTitle, ctx);
  const outDocx = path.resolve(__dirname, '../temp/storyboard-verify.docx');
  fs.mkdirSync(path.dirname(outDocx), { recursive: true });
  fs.writeFileSync(outDocx, buffer);
  console.log('Wrote', outDocx, buffer.length, 'bytes');

  // Emit a plain-text extract for quick grep-based inspection.
  const AdmZip = require('adm-zip');
  const zip = new AdmZip(buffer);
  const docXml = zip.getEntry('word/document.xml').getData().toString('utf8');
  const runs = [];
  const re = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let m;
  while ((m = re.exec(docXml)) !== null) if (m[1]) runs.push(m[1]);
  const txtOut = path.resolve(__dirname, '../temp/storyboard-verify.txt');
  fs.writeFileSync(txtOut, runs.join('\n'), 'utf8');
  console.log('Wrote', txtOut, runs.length, 'runs');

  // Count embedded images (word/media/* entries).
  const mediaEntries = zip.getEntries().filter((e) => e.entryName.startsWith('word/media/'));
  console.log('Embedded images:', mediaEntries.length);
  for (const e of mediaEntries) console.log(' -', e.entryName, e.header.size, 'B');

  const pdfBuffer = await convert.blocksToPdf(blocks, docTitle, ctx);
  const outPdf = path.resolve(__dirname, '../temp/storyboard-verify.pdf');
  fs.writeFileSync(outPdf, pdfBuffer);
  console.log('Wrote', outPdf, pdfBuffer.length, 'bytes');
}

main().catch((err) => {
  console.error('VERIFY FAILED:', err);
  process.exitCode = 1;
});
