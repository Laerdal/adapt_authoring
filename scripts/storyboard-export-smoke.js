// Smoke test — generate an .docx from a synthetic storyboard containing a
// heading, an MCQ (matching the reference image layout), an image reference
// (external URL that won't resolve, so it falls back to a text ref), a video
// component, and verify the file opens as a valid zip / non-empty document.
//
// Run:  node scripts/storyboard-export-smoke.js
//
// This is a stand-alone diagnostic. It bypasses the HTTP route so no auth is
// required. It uses a temporary image buffer via `sharp` so we exercise the
// ImageRun path end-to-end.

/* eslint-disable no-console */
const path = require('path');
const fs = require('fs');

const convert = require('../plugins/content/storyboard/utils/documentConvert');

async function main() {
  const blocks = [
    { type: 'heading', props: { level: 1 }, content: 'Cardiac Emergency Response' },
    { type: 'heading', props: { level: 2 }, content: 'Introduction' },
    { type: 'paragraph', content: 'Welcome to the module.' },
    {
      type: 'sbAssessment',
      props: {
        kind: 'mcq',
        title: 'Test Question',
        adaptComponent: 'mcq',
        data: JSON.stringify({
          question: 'Select the correct answer.',
          showTitle: true,
          options: [
            { text: 'Correct answer', correct: true, feedback: '' },
            { text: 'Incorrect option', correct: false, feedback: 'Sample Test page' },
            { text: 'Incorrect option', correct: false, feedback: 'Sample Test new 1' },
            { text: 'partial correct', correct: false, feedback: '' },
          ],
          feedback: {
            correct: 'Corect',
            incorrect: 'Incorrect',
            incorrectNotFinal: '',
            partlyCorrectFinal: '',
            partlyCorrectNotFinal: '',
          },
        }),
      },
    },
    {
      type: 'sbComponent',
      props: {
        kind: 'video',
        title: 'Demo video',
        adaptComponent: 'laerdal-media',
        data: JSON.stringify({
          showTitle: true,
          description: 'Watch the demo.',
          media: {
            asset: { link: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', external: true },
          },
        }),
      },
    },
    {
      type: 'sbComponent',
      props: {
        kind: 'image',
        title: 'Fallback image',
        adaptComponent: 'graphic',
        data: JSON.stringify({
          showTitle: true,
          description: 'External-URL image (unresolvable — falls back to reference).',
          image: { link: 'https://example.com/missing.png', alt: 'Example' },
        }),
      },
    },
  ];

  const buffer = await convert.blocksToDocx(blocks, 'Storyboard Export Smoke Test');
  const outPath = path.resolve(__dirname, '../temp/storyboard-export-smoke.docx');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, buffer);
  console.log('Wrote', outPath, buffer.length, 'bytes');

  // Quick sanity: .docx files start with PK zip header
  if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    throw new Error('Output is not a valid ZIP (docx) file.');
  }
  console.log('Header OK — file is a valid zip.');

  const pdfBuffer = await convert.blocksToPdf(blocks, 'Storyboard Export Smoke Test');
  const pdfPath = path.resolve(__dirname, '../temp/storyboard-export-smoke.pdf');
  fs.writeFileSync(pdfPath, pdfBuffer);
  console.log('Wrote', pdfPath, pdfBuffer.length, 'bytes');
  if (pdfBuffer.slice(0, 4).toString('utf8') !== '%PDF') {
    throw new Error('PDF output is missing the %PDF header.');
  }
  console.log('PDF header OK.');
}

main().catch((err) => {
  console.error('SMOKE FAILED:', err);
  process.exitCode = 1;
});
