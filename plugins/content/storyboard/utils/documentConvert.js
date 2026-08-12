// Storyboard ⇄ document conversion (ADAPT-3760, Phase 7 / AC10).
//
// Export: BlockNote document → Word (.docx) via the `docx` lib.
// Import:  .docx (mammoth) / .pptx (adm-zip, best-effort) / .pdf (pdf-parse if
//          installed) → BlockNote blocks, preserving heading hierarchy.

const { Document, Packer, Paragraph, HeadingLevel, TextRun } = require('docx');

const HEADING_LEVEL = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
};

function inlineToText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.map((n) => (n && typeof n.text === 'string' ? n.text : '')).join('');
}

function safeParse(value, fallback) {
  if (typeof value !== 'string') return value == null ? fallback : value;
  try {
    return JSON.parse(value);
  } catch (e) {
    return fallback;
  }
}

function stripTags(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

// ── Export → .docx ──────────────────────────────────────────────────────────

async function blocksToDocx(blocks, title) {
  const children = [];
  if (title) children.push(new Paragraph({ text: title, heading: HeadingLevel.TITLE }));

  for (const b of Array.isArray(blocks) ? blocks : []) {
    const text = inlineToText(b && b.content);
    const props = (b && b.props) || {};
    if (b && b.type === 'heading') {
      children.push(new Paragraph({ text, heading: HEADING_LEVEL[props.level] || HeadingLevel.HEADING_4 }));
    } else if (b && b.type === 'sbAssessment') {
      const data = safeParse(props.data, {});
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `[Assessment: ${props.kind || ''}] `, bold: true }),
            new TextRun(data.question || ''),
          ],
        })
      );
    } else if (b && b.type === 'sbPlaceholder') {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `[${props.label || 'Placeholder'}] `, bold: true }),
            new TextRun(props.title || ''),
          ],
        })
      );
    } else if (text) {
      children.push(new Paragraph(text));
    }
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

// ── Export → .pdf ────────────────────────────────────────────────────────────
// Server-side PDF via pdfkit (pure-JS, no native deps). Renders the same block
// shapes as the Word export: a title, headings (sized by level), assessment /
// placeholder call-outs, and paragraphs.

const PDF_HEADING_SIZE = { 1: 20, 2: 16, 3: 14, 4: 12 };

function blocksToPdf(blocks, title) {
  const PDFDocument = require('pdfkit');
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 56, size: 'A4' });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      if (title) {
        doc.font('Helvetica-Bold').fontSize(24).text(title);
        doc.moveDown(0.8);
      }

      for (const b of Array.isArray(blocks) ? blocks : []) {
        const text = inlineToText(b && b.content);
        const props = (b && b.props) || {};
        if (b && b.type === 'heading') {
          const size = PDF_HEADING_SIZE[props.level] || 12;
          doc.font('Helvetica-Bold').fontSize(size).text(text || '');
          doc.moveDown(0.4);
        } else if (b && b.type === 'sbAssessment') {
          const data = safeParse(props.data, {});
          doc.font('Helvetica-Bold').fontSize(11).text(`[Assessment: ${props.kind || ''}]`, { continued: true });
          doc.font('Helvetica').text(` ${data.question || ''}`);
          doc.moveDown(0.3);
        } else if (b && b.type === 'sbComponent') {
          const data = safeParse(props.data, {});
          doc.font('Helvetica-Bold').fontSize(11).text(`[${props.kind || 'Component'}]`, { continued: true });
          doc.font('Helvetica').text(` ${props.title || ''}`);
          if (data.description) doc.font('Helvetica').fontSize(11).text(data.description);
          doc.moveDown(0.3);
        } else if (b && b.type === 'sbPlaceholder') {
          doc.font('Helvetica-Bold').fontSize(11).text(`[${props.label || 'Placeholder'}]`, { continued: true });
          doc.font('Helvetica').text(` ${props.title || ''}`);
          doc.moveDown(0.3);
        } else if (text) {
          doc.font('Helvetica').fontSize(11).text(text);
          doc.moveDown(0.3);
        }
      }

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

// ── Import → BlockNote blocks ────────────────────────────────────────────────

// Convert block-level HTML (h1–h6 / p / li) into blocks, preserving headings.
function htmlToBlocks(html) {
  const blocks = [];
  const re = /<(h[1-6]|p|li)[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const tag = m[1].toLowerCase();
    const text = stripTags(m[2]);
    if (!text) continue;
    if (tag[0] === 'h') {
      const level = Math.min(parseInt(tag[1], 10) || 1, 4);
      blocks.push({ type: 'heading', props: { level }, content: text });
    } else {
      blocks.push({ type: 'paragraph', content: text });
    }
  }
  if (!blocks.length) {
    stripTags(html)
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((t) => blocks.push({ type: 'paragraph', content: t }));
  }
  return blocks;
}

async function wordToBlocks(buffer) {
  const mammoth = require('mammoth');
  const { value: html } = await mammoth.convertToHtml({ buffer });
  return htmlToBlocks(html);
}

// Best-effort PPTX: read slide XML text runs; each slide → an H2 + paragraphs.
function pptxToBlocks(buffer) {
  const AdmZip = require('adm-zip');
  const zip = new AdmZip(buffer);
  const slideNo = (name) => parseInt((name.match(/slide(\d+)\.xml$/) || [])[1] || '0', 10);
  const slides = zip
    .getEntries()
    .filter((e) => /^ppt\/slides\/slide\d+\.xml$/.test(e.entryName))
    .sort((a, b) => slideNo(a.entryName) - slideNo(b.entryName));

  const blocks = [];
  slides.forEach((entry, i) => {
    const xml = entry.getData().toString('utf8');
    const texts = (xml.match(/<a:t>([\s\S]*?)<\/a:t>/g) || [])
      .map((t) => stripTags(t))
      .filter(Boolean);
    blocks.push({ type: 'heading', props: { level: 2 }, content: `Slide ${i + 1}` });
    texts.forEach((t) => blocks.push({ type: 'paragraph', content: t }));
  });
  return blocks;
}

// PDF is best-effort and requires the optional pdf-parse package.
async function pdfToBlocks(buffer) {
  let pdfParse;
  try {
    pdfParse = require('pdf-parse');
  } catch (e) {
    const err = new Error('PDF import requires the optional "pdf-parse" package (not installed).');
    err.statusCode = 501;
    throw err;
  }
  const data = await pdfParse(buffer);
  return String(data.text || '')
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((t) => ({ type: 'paragraph', content: t }));
}

module.exports = { blocksToDocx, blocksToPdf, wordToBlocks, pptxToBlocks, pdfToBlocks };
