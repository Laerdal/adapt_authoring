// Storyboard ⇄ document conversion (ADAPT-3760/3785, Phase 7 / AC10).
//
// Export: BlockNote document → Word (.docx) via the `docx` lib. Embeds real
//         asset bytes for image / video-poster references (see assetResolver)
//         and renders MCQ / checklist / matching / reorder assessments with a
//         proper option list + per-option feedback + whole-question feedback
//         + submit instruction, matching the Storyboard's own Preview.
// Import: .docx (mammoth) / .pptx (adm-zip, best-effort) / .pdf (pdfjs-dist,
//         layout-inferred structure) → BlockNote blocks, preserving heading
//         hierarchy.

const {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
  ImageRun,
  ExternalHyperlink,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
} = require('docx');

const assetResolver = require('./assetResolver');
const { buildCustomProperties } = require('./normalize/reimportMetadata');
const { parseDocxToNormalizedDocument } = require('./normalize/docxNormalizer');
const { parsePdfToNormalizedDocument } = require('./normalize/pdfNormalizer');
const { normalizedDocumentToBlockNote } = require('./normalize/toBlockNote');

// Kind label shown above a component's content in the exported document
// (mirrors the Storyboard card badges).
const COMPONENT_KIND_LABEL = {
  text: 'Text',
  groupedContent: 'Grouped Content',
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
  h5p: 'H5P',
  laerdalForm: 'Laerdal Form',
  assessmentResult: 'Assessment Result',
};

const ASSESSMENT_KIND_LABEL = {
  mcq: 'MCQ',
  gmcq: 'Graphic MCQ',
  matching: 'Matching',
  reorder: 'Sentence Reordering',
  textInput: 'Text Input',
  slider: 'Slider',
  checklist: 'Checklist',
};

// Same footer text the Storyboard shows below each assessment card. Kept in
// sync with new-ui-source/src/components/storyboard/blocks/assessmentBlock.tsx.
const ASSESSMENT_FOOTER = {
  mcq: 'Select one option and then select Submit.',
  gmcq: 'Select one option and then select Submit.',
  matching: 'Match each item to its correct pair and then select Submit.',
  reorder: 'Place the items in the correct order and then select Submit.',
  textInput: 'Type your answer and then select Submit.',
  slider: 'Move the slider to your answer and then select Submit.',
  checklist: 'Tick the items that apply and then select Submit.',
};

const HEADING_LEVEL = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
};

// Shown ONLY when a heading has no text at all (not even an un-renamed
// default title) — used so the heading paragraph is never written with
// blank text, which docxNormalizer.js's import would then fail to recognize
// as a heading at all (it requires non-empty trimmed text), dropping the
// whole structural boundary on reimport.
const HEADING_LEVEL_FALLBACK = {
  1: 'Untitled Topic',
  2: 'Untitled Section',
  3: 'Untitled Content Group',
  4: 'Untitled Component',
};

// docx spacing units are twentieths of a point. 240 = 12pt = one line at 12pt.
// Mirrors Word's default heading spacing so the export doesn't look
// wall-to-wall (ADAPT-3785 §1: "spacing before/after headings").
const HEADING_SPACING = {
  1: { before: 480, after: 240 }, // 24pt / 12pt
  2: { before: 360, after: 200 }, // 18pt / 10pt
  3: { before: 300, after: 180 }, // 15pt / 9pt
  4: { before: 240, after: 160 }, // 12pt / 8pt
};

// Titles the Adapt content plugins auto-inject when a node has no author-
// supplied title (see plugins/content/*/model.schema `default` values plus
// the storyboard editor's historical seed text). These must never be emitted
// into the exported document — a defensive, last-line-of-defence filter for
// legacy storyboard records whose documentJson still carries them from before
// the projector was fixed. Keep in sync with new-ui-source/src/components/
// storyboard/placeholderTitles.ts::DEFAULT_SCHEMA_TITLES.
// Kept lowercase so match is case-insensitive — a legacy record might carry
// "Article title" (small t) which shouldn't sneak past the filter.
const DEFAULT_PLACEHOLDER_TITLES = new Set([
  'new article title',
  'new block title',
  'new component title',
  'new menu/page title',
  'new course title',
  'new page title',
  // New-UI structure terminology (Topic / Section / Content Group)
  'new topic title',
  'new section title',
  'new content group title',
  'article title',
  'block title',
  'component title',
  'section title',
  'page title',
  'topic title',
  'content group title',
]);
function isPlaceholderTitle(text) {
  const t = String(text || '').trim().toLowerCase();
  return !t || DEFAULT_PLACEHOLDER_TITLES.has(t);
}

// Strip HTML tags + decode a handful of common entities. Adapt's Authoring
// Tool stores rich-text fields (question feedback, per-option feedback,
// component body) as HTML — the storyboard load path currently passes those
// through verbatim, so a naïve `TextRun(fb.correct)` renders "<p>Correct</p>"
// literally inside the exported Word/PDF document. Feedback rows in a Word
// doc are single-line runs, so all we need is the plain text.
function stripHtml(text) {
  if (text == null) return '';
  return String(text)
    // block-level tags → space so "<p>A</p><p>B</p>" doesn't collapse to "AB"
    .replace(/<\s*(br|\/p|\/div|\/li|\/h[1-6])\s*[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// Converts a rich-text HTML field (description/instruction/question — the
// BasicRichTextEditor fields, which store contentEditable-produced HTML like
// "<p>Watch the video</p><div><br></div><div><br></div>") into plain text
// with one newline per original block, instead of flattening to one line.
// Unlike stripHtml (deliberately single-line, for feedback rows), this is for
// fields that are genuinely multi-paragraph — pushTextParagraphs (DOCX) and
// pdfkit's own multi-line text() (PDF) both split/wrap on '\n', so block
// boundaries need to become real newlines, not get discarded. Without this,
// the raw HTML (tags included) was rendered as literal visible text in the
// exported document, since plain text-splitting on '\n' never sees a tag.
function htmlToParagraphText(html) {
  if (html == null) return '';
  return String(html)
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/(p|div|li|h[1-6])\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n') // collapse runs of blank lines to at most one
    .trim();
}

const RICH_TEXT_MARK_TAGS = {
  strong: 'bold', b: 'bold', em: 'italic', i: 'italic', u: 'underline',
  s: 'strike', strike: 'strike', sub: 'subscript', sup: 'superscript',
};
const RICH_TEXT_BLOCK_TAGS = new Set(['p', 'div', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote']);

// Parses a rich-text HTML field (description/instruction/question — the
// BasicRichTextEditor fields) into paragraphs of BlockNote-shaped inline runs
// (`{ text, styles: { bold, italic, underline, strike, subscript,
// superscript } }` — the SAME shape `inlineToRuns`/`inlineToText` above
// already consume) instead of flattening to plain text. Author-applied
// bold/italic/underline/strike/subscript/superscript previously never made
// it into the exported document at all (htmlToParagraphText strips every
// tag, keeping only the text) — this is what actually renders them as real
// Word/PDF formatting instead of losing it on every export.
function parseRichTextHtml(html) {
  const source = String(html || '').trim();
  if (!source) return [];

  const { Parser } = require('htmlparser2');
  const { DomHandler } = require('domhandler');
  const domutils = require('domutils');

  let dom = [];
  const handler = new DomHandler((err, result) => { if (!err) dom = result; });
  const parser = new Parser(handler, { decodeEntities: true });
  parser.write(source);
  parser.end();

  const paragraphs = [];
  let current = null;
  const flush = () => {
    if (current && current.some((r) => r.text.trim())) paragraphs.push(current);
    current = null;
  };
  const ensure = () => {
    if (!current) current = [];
    return current;
  };
  // `<li>` is a recognized block tag (its own paragraph), but without this a
  // list rendered no differently from a run of plain paragraphs — the bullet/
  // number marker was dropped entirely, not just the <ul>/<ol> wrapper, so
  // the export still didn't read as a list even once the raw tags were gone.
  // `listCtx` threads the enclosing <ul>/<ol> (and an order counter for <ol>)
  // down through the recursion so each <li> can prefix itself.
  const walk = (node, styles, listCtx) => {
    if (!node) return;
    if (node.type === 'text') {
      if (node.data) ensure().push({ text: node.data, styles });
      return;
    }
    if (node.type !== 'tag') return;
    const tag = node.name;
    if (tag === 'br') {
      ensure().push({ text: '\n', styles });
      return;
    }
    if (tag === 'ul' || tag === 'ol') {
      const childListCtx = { type: tag, counter: 0 };
      for (const child of domutils.getChildren(node) || []) walk(child, styles, childListCtx);
      return;
    }
    const nextStyles = RICH_TEXT_MARK_TAGS[tag] ? { ...styles, [RICH_TEXT_MARK_TAGS[tag]]: true } : styles;
    const isBlock = RICH_TEXT_BLOCK_TAGS.has(tag);
    if (isBlock) flush();
    if (tag === 'li' && listCtx) {
      listCtx.counter += 1;
      ensure().push({ text: listCtx.type === 'ol' ? `${listCtx.counter}. ` : '• ', styles: {} });
    }
    for (const child of domutils.getChildren(node) || []) walk(child, nextStyles, listCtx);
    if (isBlock) flush();
  };
  for (const node of dom) walk(node, {}, null);
  flush();

  if (paragraphs.length) return paragraphs;

  // No recognizable block/inline markup at all (e.g. the field somehow holds
  // plain text already) — fall back to the plain-text split so nothing is
  // lost, just unstyled.
  const plain = htmlToParagraphText(source);
  return plain ? plain.split('\n').filter((l) => l.trim()).map((line) => [{ text: line, styles: {} }]) : [];
}

// BlockNote inline content can be a plain string OR an array of styled runs
// (`{ type: 'text', text, styles: { bold, italic, underline } }`). Flatten to
// styled Word TextRuns so bold/italic/underline formatting round-trips
// (ADAPT-3785 §1: "Bold/italic/underline formatting").
function inlineToRuns(content) {
  if (typeof content === 'string') return content.trim() ? [new TextRun(content)] : [];
  if (!Array.isArray(content)) return [];
  const runs = [];
  for (const n of content) {
    if (!n) continue;
    if (typeof n === 'string') {
      runs.push(new TextRun(n));
      continue;
    }
    if (typeof n.text !== 'string' || !n.text) continue;
    const styles = n.styles || {};
    runs.push(
      new TextRun({
        text: n.text,
        bold: !!styles.bold,
        italics: !!styles.italic,
        underline: styles.underline ? {} : undefined,
        strike: !!styles.strike,
        subScript: !!styles.subscript,
        superScript: !!styles.superscript,
      }),
    );
  }
  return runs;
}

function inlineToText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.map((n) => (n && typeof n.text === 'string' ? n.text : '')).join('');
}

/** A table cell's content may be a bare inline-run array (partial/imported input) or the wrapped `{type:'tableCell', content}` shape BlockNote's own editor.document always produces — normalize both to a run array. */
function tableCellRuns(cell) {
  if (Array.isArray(cell)) return cell;
  if (cell && Array.isArray(cell.content)) return cell.content;
  return [];
}

// Build a docx Table from a native BlockNote `table` block's
// `{type:'tableContent', rows:[{cells:[...]}]}` content, one column-width
// percentage split evenly across the widest row.
function tableContentToDocxTable(content) {
  const rows = content && Array.isArray(content.rows) ? content.rows : [];
  if (!rows.length) return null;
  const colCount = Math.max(1, ...rows.map((r) => (Array.isArray(r.cells) ? r.cells.length : 0)));
  const colWidthPct = Math.floor(100 / colCount);
  const tableRows = rows.map((row) => {
    const cells = Array.isArray(row.cells) ? row.cells : [];
    const rowCells = [];
    for (let c = 0; c < colCount; c++) {
      const runs = inlineToRuns(tableCellRuns(cells[c]));
      rowCells.push(
        new TableCell({
          width: { size: colWidthPct, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: runs.length ? runs : [new TextRun('')] })],
        }),
      );
    }
    return new TableRow({ children: rowCells });
  });
  return new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE } });
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

// Rich cards (sbComponent/sbAssessment) render as human-readable prose for
// anyone opening the document, but that prose has no reliable way to encode
// things like "which option is correct" — re-parsing it loses the card's
// real structure (ADAPT-3760 import round-trip). So each card's rendering is
// bracketed by a hidden (Word "vanish" — genuinely invisible, never printed,
// but still present in the underlying XML) marker pair carrying the card's
// original block verbatim. On import, docxNormalizer.js recognizes the
// markers and reconstructs the exact original block instead of re-deriving
// it from the prose. Falls back to the lossy prose reading if the markers
// are missing/stripped — never a hard failure.
const CARD_MARKER_BEGIN = 'SB_CARD_BEGIN::';
const CARD_MARKER_END = 'SB_CARD_END';

function pushCardBeginMarker(children, type, props) {
  const payload = JSON.stringify({ type, props });
  children.push(new Paragraph({ children: [new TextRun({ text: `${CARD_MARKER_BEGIN}${payload}`, vanish: true })] }));
}
function pushCardEndMarker(children) {
  children.push(new Paragraph({ children: [new TextRun({ text: CARD_MARKER_END, vanish: true })] }));
}

// A multi-line description (blank-line-separated paragraphs) becomes one
// Word paragraph per line, so authored spacing/structure survives export.
function pushTextParagraphs(children, text, opts) {
  const lines = String(text || '').split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    children.push(
      new Paragraph({
        spacing: { before: 60, after: 60 },
        children: [new TextRun({ text: line, italics: !!(opts && opts.italic) })],
      }),
    );
  }
}

// Renders a rich-text HTML field (description/instruction/question) as one
// real, formatted Word paragraph per source block — bold/italic/underline/
// strike/subscript/superscript survive as actual docx run styling instead of
// being flattened to plain text.
function pushRichTextParagraphs(children, html) {
  const paragraphs = parseRichTextHtml(html);
  for (const runs of paragraphs) {
    children.push(new Paragraph({ spacing: { before: 60, after: 60 }, children: inlineToRuns(runs) }));
  }
}

// Push an image ref (already resolved via assetResolver) as an ImageRun. Falls
// back to a bracketed text reference if resolution failed (external URL, etc.).
async function pushImageRef(children, ref, label, ctx) {
  try {
    let resolved = await assetResolver.resolveAnyImage(ref, ctx);
    if (resolved) {
      // See assetResolver.js's normalizeImageForEmbedding comment: for an
      // SVG this returns a `{ type: 'svg', fallback }` shape (never null) —
      // Word 2016+ renders the SVG natively via docx's asvg:svgBlip
      // extension, so the embed doesn't depend on sharp/librsvg succeeding.
      resolved = await assetResolver.normalizeImageForEmbedding(resolved);
    }
    if (resolved) {
      const isSvg = String(resolved.type || '').toLowerCase() === 'svg';
      children.push(
        new Paragraph({
          spacing: { before: 120, after: 120 },
          children: [
            new ImageRun({
              data: resolved.buffer,
              type: resolved.type,
              transformation: { width: resolved.width, height: resolved.height },
              ...(isSvg ? { fallback: { type: resolved.fallback.type, data: resolved.fallback.buffer } } : {}),
              altText: resolved.alt
                ? { title: resolved.alt, description: resolved.alt, name: resolved.alt }
                : undefined,
            }),
          ],
        }),
      );
      if (resolved.alt) {
        children.push(
          new Paragraph({
            spacing: { before: 0, after: 120 },
            children: [new TextRun({ text: resolved.alt, italics: true, size: 18 })],
          }),
        );
      }
      return true;
    }
  } catch (e) {
    // Logged (not silently swallowed) so a genuine embedding failure — e.g.
    // docx's ImageRun rejecting an SVG that slipped through un-rasterized —
    // is distinguishable in server logs from "this ref just isn't a DAM
    // asset", which is the far more common, expected reason this falls
    // through to the text-reference placeholder below.
    console.error('[storyboard] image embed failed, falling back to a text reference:', e && e.message);
  }
  // Reference-only fallback (external URL / permission denied / deleted).
  const link = (ref && (ref.link || ref.url)) || '';
  if (link && /^https?:\/\//i.test(link)) {
    children.push(
      new Paragraph({
        spacing: { before: 60, after: 60 },
        children: [
          new TextRun({ text: `${label}: `, bold: true }),
          new ExternalHyperlink({
            link,
            children: [new TextRun({ text: link, style: 'Hyperlink' })],
          }),
        ],
      }),
    );
  } else if (link) {
    children.push(
      new Paragraph({
        spacing: { before: 60, after: 60 },
        children: [new TextRun({ text: `[${label} — ${link}]`, italics: true })],
      }),
    );
  }
  return false;
}

// ── sbComponent → paragraphs ────────────────────────────────────────────────
// Async because we may need to load asset bytes off disk for images / posters.
async function sbComponentToDocxParagraphs(children, props, ctx) {
  const kind = props.kind || 'text';
  const data = safeParse(props.data, {});
  const rawTitle = (props.title || '').trim();
  // A schema-default title ("New Component Title" etc.) is scaffolding, not
  // authored content — treat it as absent so we don't emit a header line
  // reading "Text — New Component Title" (ADAPT-3785).
  const title = isPlaceholderTitle(rawTitle) ? '' : rawTitle;
  const label = COMPONENT_KIND_LABEL[kind] || kind;

  const description = data.description ? htmlToParagraphText(data.description) : '';
  const instruction = data.instruction ? htmlToParagraphText(data.instruction) : '';
  const image = data.image || null;
  const media = data.media || null;
  const hasImageAsset = !!(image && (image.link || image.assetId));
  const hasMediaAsset = !!(media && media.asset && (media.asset.link || media.asset.assetId));
  const hasMediaPoster = !!(media && media.poster && (media.poster.link || media.poster.assetId));
  const hasGroupItems =
    kind === 'groupedContent' &&
    Array.isArray(data.items) &&
    data.items.some((it) => it && (it.title || it.body || it.image));
  const hasFormFields =
    kind === 'laerdalForm' && Array.isArray(data.fields) && data.fields.some((f) => f && f.label);

  // NOTE: a brand-new/unauthored component (no title/description/etc.) is
  // NOT skipped here — it still gets a card marker + its bare "{label}"
  // header line below. "Update content only" (storyboardContentUpdate.ts)
  // matches reimported content back to the live course by POSITION, so
  // omitting a component from the export entirely would shift every later
  // sibling's match in the reimported document and corrupt the course — this
  // was the confirmed root cause of a reported "reimport breaks the whole
  // course structure" bug. The header-only render below already degrades
  // gracefully to just the kind label when there's nothing else to show.

  pushCardBeginMarker(children, 'sbComponent', props);

  // Kind badge + title on the same line (bold). Spaced above so it visually
  // separates from the previous block/heading.
  children.push(
    new Paragraph({
      spacing: { before: 240, after: 80 },
      children: [
        new TextRun({ text: `${label}${title ? ' — ' : ''}`, bold: true }),
        new TextRun({ text: title, bold: true }),
      ],
    }),
  );

  if (description) pushRichTextParagraphs(children, data.description);

  // Image component: embed the picked asset (or fall back to a text ref).
  if (kind === 'image' && hasImageAsset) {
    await pushImageRef(children, image, 'Image', ctx);
  }

  // Video / audio: poster image (if configured) + the media URL. This
  // satisfies ADAPT-3785 §5 (video poster + URL in preview and export) —
  // author-configured URLs are preserved verbatim, no dummy fallback.
  if (kind === 'video' || kind === 'audio') {
    if (hasMediaPoster) {
      await pushImageRef(children, media.poster, 'Poster', ctx);
    }
    if (hasMediaAsset) {
      const link = String((media.asset && (media.asset.link || media.asset.url)) || '');
      if (link) {
        children.push(
          new Paragraph({
            spacing: { before: 60, after: 60 },
            children: [
              new TextRun({ text: `${label} URL: `, bold: true }),
              /^https?:\/\//i.test(link)
                ? new ExternalHyperlink({
                    link,
                    children: [new TextRun({ text: link, style: 'Hyperlink' })],
                  })
                : new TextRun({ text: link }),
            ],
          }),
        );
      }
    }
    // Transcript text is authored content — include it verbatim if present.
    if (media && media.transcriptText) {
      children.push(
        new Paragraph({
          spacing: { before: 120, after: 40 },
          children: [new TextRun({ text: 'Transcript:', bold: true })],
        }),
      );
      pushTextParagraphs(children, String(media.transcriptText));
    }
  }

  // Grouped content: each item as a title + body, and its own image if present.
  if (hasGroupItems) {
    for (const item of data.items) {
      if (!item) continue;
      const t = String(item.title || '').trim();
      const b = String(item.body || '').trim();
      if (!t && !b && !item.image) continue;
      if (t) {
        children.push(
          new Paragraph({
            spacing: { before: 120, after: 40 },
            children: [new TextRun({ text: t, bold: true })],
          }),
        );
      }
      // `item.body` is rich-text HTML from the grouped-content card's editor
      // (same shape as description/instruction) — pushTextParagraphs only
      // splits on literal newline characters, which raw HTML never contains,
      // so the whole "<p>...</p>" string was landing in the document as one
      // literal, unparsed line of tags instead of formatted paragraphs.
      if (b) pushRichTextParagraphs(children, b);
      if (item.image) {
        // eslint-disable-next-line no-await-in-loop
        await pushImageRef(
          children,
          { link: item.image, assetId: item.imageAssetId, alt: t },
          'Image',
          ctx,
        );
      }
    }
  }

  // Laerdal Form: list of field labels + control types.
  if (hasFormFields) {
    for (const f of data.fields) {
      if (!f || !f.label) continue;
      children.push(
        new Paragraph({
          indent: { left: 360 },
          spacing: { before: 40, after: 40 },
          children: [new TextRun(`• ${f.label} (${f.control || 'field'})`)],
        }),
      );
    }
  }

  if (instruction) {
    // A bold "Instruction:" label (same convention as "Transcript:" above)
    // visually distinguishes the section WITHOUT touching the content's own
    // formatting — forcing every run italic (an earlier version of this
    // code) is fundamentally lossy in OOXML: a run can't represent "italic
    // for two different reasons," so an author's OWN <em> text became
    // indistinguishable from the baseline convention and both or neither
    // survived reimport. The label doubles as an unambiguous reimport marker
    // (see reconcileCardProps in toBlockNote.js) — simpler than the italic
    // heuristic it replaces, which also had to special-case an image's alt
    // caption to avoid misreading it as instruction text.
    children.push(
      new Paragraph({
        spacing: { before: 120, after: 40 },
        children: [new TextRun({ text: 'Instruction:', bold: true })],
      }),
    );
    pushRichTextParagraphs(children, data.instruction);
  }

  pushCardEndMarker(children);
}

// ── sbAssessment → paragraphs (matches the Storyboard Preview) ──────────────
// Reference layout (ADAPT-3785 §2 image):
//
//   Test Question                                   ← question title, bold
//   Body text of the question…
//   ● Correct answer                                ← bullet: ● = correct
//       Feedback for correct answer                 ← italic, indented
//   ○ Incorrect option                              ← ○ = incorrect
//       Sample Test page
//   ○ Incorrect option
//       Sample Test new 1
//   ○ partial correct
//
//   Correct: Corect                                 ← whole-question feedback
//   Incorrect: Incorrect
//
//   Select one option and then select Submit.        ← italic submit hint
//
async function sbAssessmentToDocxParagraphs(children, props, ctx) {
  const kind = props.kind || 'mcq';
  const data = safeParse(props.data, {});
  const rawTitle = (props.title || '').trim();
  const title = isPlaceholderTitle(rawTitle) ? '' : rawTitle;
  const question = data.question ? htmlToParagraphText(data.question) : '';
  const options = Array.isArray(data.options) ? data.options.filter((o) => o && o.text) : [];
  const items = Array.isArray(data.items) ? data.items.filter(Boolean) : [];
  const pairs = Array.isArray(data.pairs) ? data.pairs.filter((p) => p && (p.prompt || (Array.isArray(p.options) && p.options.length))) : [];
  const answers = Array.isArray(data.answers) ? data.answers.filter(Boolean) : [];
  const fb = data.feedback || {};

  // NOTE: an unauthored assessment card is NOT skipped — see the matching
  // comment in sbComponentToDocxParagraphs above (same position-matching
  // reimport-corruption reason). The header-only render below already
  // degrades gracefully to just the kind label when there's nothing else.

  pushCardBeginMarker(children, 'sbAssessment', props);

  // Question Title/Body resolution (PR review — no duplicated text):
  //   • The block-level Title is the primary header; when the author left it
  //     empty the question Body stands in as the header.
  //   • The question Body is emitted as its own paragraph only when it isn't
  //     already the header text — so the same sentence never renders twice.
  // The header is always a single line — collapse any paragraph breaks
  // htmlToParagraphText preserved in `question` (a plain '\n' inside one
  // docx TextRun isn't a real line break; it'd just render as stray
  // whitespace). The full multi-paragraph question still appears correctly
  // below via pushTextParagraphs when `showQuestionParagraph` is true.
  const headerText = title || question.replace(/\n+/g, ' ').trim();
  const showQuestionParagraph = !!question && question !== headerText;

  // Type badge + title (mirrors the collapsed Preview header).
  const kindLabel = ASSESSMENT_KIND_LABEL[kind] || 'Question';
  children.push(
    new Paragraph({
      spacing: { before: 240, after: 80 },
      children: [
        new TextRun({ text: `${kindLabel}${headerText ? ' — ' : ''}`, bold: true }),
        new TextRun({ text: headerText, bold: true }),
      ],
    }),
  );

  // Question body — only when it isn't already the header.
  if (showQuestionParagraph) pushRichTextParagraphs(children, data.question);

  // Per-kind body.
  if (kind === 'mcq' || kind === 'gmcq' || kind === 'checklist') {
    for (const opt of options) {
      const glyph = opt.correct ? '● ' : '○ ';
      children.push(
        new Paragraph({
          indent: { left: 360 },
          spacing: { before: 40, after: 20 },
          children: [
            new TextRun({ text: glyph, bold: !!opt.correct }),
            new TextRun({ text: stripHtml(opt.text), bold: !!opt.correct }),
          ],
        }),
      );
      // Graphic MCQ per-option image.
      if (kind === 'gmcq' && (opt.image || opt.imageAssetId)) {
        // eslint-disable-next-line no-await-in-loop
        await pushImageRef(
          children,
          { link: opt.image, assetId: opt.imageAssetId, alt: opt.text },
          'Option image',
          ctx,
        );
      }
      // Per-option feedback is stored as HTML by Adapt (`<p>...</p>`);
      // stripHtml keeps it as a single readable run in the docx.
      const optFb = stripHtml(opt.feedback);
      if (optFb) {
        children.push(
          new Paragraph({
            indent: { left: 720 }, // deeper indent under the option
            spacing: { before: 0, after: 40 },
            children: [new TextRun({ text: optFb, italics: true })],
          }),
        );
      }
    }
    if (kind === 'checklist' && data.selectable) {
      children.push(
        new Paragraph({
          spacing: { before: 60, after: 60 },
          children: [
            new TextRun({ text: 'Selectable: ', bold: true }),
            new TextRun(String(data.selectable)),
          ],
        }),
      );
    }
  } else if (kind === 'matching') {
    for (const p of pairs) {
      // Get the correct option from options array (if available)
      const correctOption = Array.isArray(p.options) ? p.options.find((opt) => opt && opt.correct) : null;
      const answerText = correctOption ? String(correctOption.text || '') : '';
      children.push(
        new Paragraph({
          indent: { left: 360 },
          spacing: { before: 40, after: 20 },
          children: [
            new TextRun({ text: '• ' }),
            new TextRun({ text: String(p.prompt || '') }),
            new TextRun({ text: '  →  ', bold: true }),
            new TextRun({ text: answerText, italics: true }),
          ],
        }),
      );
    }
  } else if (kind === 'reorder') {
    items.forEach((it, i) => {
      children.push(
        new Paragraph({
          indent: { left: 360 },
          spacing: { before: 40, after: 20 },
          children: [
            new TextRun({ text: `${i + 1}. `, bold: true }),
            new TextRun({ text: String(it || '') }),
          ],
        }),
      );
    });
  } else if (kind === 'textInput') {
    for (const ans of answers) {
      children.push(
        new Paragraph({
          indent: { left: 360 },
          spacing: { before: 40, after: 20 },
          children: [
            new TextRun({ text: '• ' }),
            new TextRun({ text: 'Accepted answer: ', italics: true }),
            new TextRun({ text: String(ans) }),
          ],
        }),
      );
    }
  } else if (kind === 'slider' && data.slider) {
    const s = data.slider;
    children.push(
      new Paragraph({
        indent: { left: 360 },
        spacing: { before: 40, after: 20 },
        children: [
          new TextRun({ text: '• Range: ', bold: true }),
          new TextRun({
            text: `${s.min ?? 0}–${s.max ?? 10} step ${s.step ?? 1}, correct answer ${s.correct ?? ''}`,
          }),
        ],
      }),
    );
  }

  // Whole-question feedback (bold label + text). Only emit labels that have
  // authored text so an empty Feedback panel doesn't produce five blank rows.
  const FEEDBACK_LABELS = [
    ['correct', 'Correct'],
    ['incorrect', 'Incorrect'],
    ['incorrectNotFinal', 'Incorrect — not final'],
    ['partlyCorrectFinal', 'Partly correct — final'],
    ['partlyCorrectNotFinal', 'Partly correct — not final'],
  ];
  // Whole-question feedback: strip HTML (Adapt stores `<p>...</p>`).
  const feedbackLines = FEEDBACK_LABELS
    .map(([k, lbl]) => [k, lbl, stripHtml(fb[k])])
    .filter(([, , v]) => v);
  if (feedbackLines.length) {
    // Small vertical gap above the feedback group (matches Preview).
    children.push(new Paragraph({ spacing: { before: 120, after: 0 }, children: [new TextRun('')] }));
    for (const [, lbl, value] of feedbackLines) {
      children.push(
        new Paragraph({
          spacing: { before: 0, after: 40 },
          children: [
            new TextRun({ text: `${lbl}: `, bold: true }),
            new TextRun({ text: value }),
          ],
        }),
      );
    }
  }

  // Submit instruction (italic) — matches the Preview footer.
  const footer = ASSESSMENT_FOOTER[kind];
  if (footer) {
    children.push(
      new Paragraph({
        spacing: { before: 160, after: 120 },
        children: [new TextRun({ text: footer, italics: true })],
      }),
    );
  }

  pushCardEndMarker(children);
}

async function blocksToDocx(blocks, title, ctx, meta) {
  const children = [];
  // Suppress the top-level TITLE paragraph when the caller only had a
  // placeholder course title on hand — no one wants "New Course Title" as
  // the export document heading (ADAPT-3785).
  if (title && !isPlaceholderTitle(title)) {
    children.push(
      new Paragraph({
        text: title,
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.LEFT,
        spacing: { before: 0, after: 360 },
      }),
    );
  }

  // Ordered-list numbering: consecutive numberedListItem blocks share one
  // counter; any other block type ends the run and resets it.
  let numberedIndex = 0;
  for (const b of Array.isArray(blocks) ? blocks : []) {
    const props = (b && b.props) || {};
    if (!b || !b.type) continue;
    if (b.type !== 'numberedListItem') numberedIndex = 0;
    if (b.type === 'heading') {
      const text = inlineToText(b.content).trim();
      const level = HEADING_LEVEL[props.level] || HeadingLevel.HEADING_4;
      const spacing = HEADING_SPACING[props.level] || HEADING_SPACING[4];
      // Always write the heading paragraph — even an un-renamed default
      // title ("New Topic Title" etc.) or a genuinely empty one is still a
      // REAL structural boundary (Topic/Section/Content Group) that "Update
      // content only" matches back to the live course by POSITION
      // (storyboardContentUpdate.ts); silently dropping it here shifted
      // every later sibling's match and corrupted the reimported course
      // (confirmed root cause of a reported "reimport breaks the whole
      // course structure" bug). A level-appropriate fallback is used only
      // for the genuinely-blank case, since docxNormalizer.js's import
      // requires non-empty text to recognize a paragraph as a heading at all.
      const runs = text
        ? inlineToRuns(b.content)
        : [new TextRun({ text: HEADING_LEVEL_FALLBACK[props.level] || 'Untitled', italics: true })];
      children.push(new Paragraph({ heading: level, spacing, children: runs }));
    } else if (b.type === 'sbComponent') {
      // eslint-disable-next-line no-await-in-loop
      await sbComponentToDocxParagraphs(children, props, ctx);
    } else if (b.type === 'sbAssessment') {
      // eslint-disable-next-line no-await-in-loop
      await sbAssessmentToDocxParagraphs(children, props, ctx);
    } else if (b.type === 'sbPlaceholder') {
      children.push(
        new Paragraph({
          spacing: { before: 120, after: 60 },
          children: [
            new TextRun({ text: `[${props.label || 'Placeholder'}] `, bold: true }),
            new TextRun(props.title || ''),
          ],
        }),
      );
    } else if (b.type === 'table') {
      const table = tableContentToDocxTable(b.content);
      if (table) children.push(table, new Paragraph({ text: '' }));
    } else if (b.type === 'bulletListItem' || b.type === 'numberedListItem') {
      const runs = inlineToRuns(b.content);
      if (!runs.length) continue;
      const prefix = b.type === 'numberedListItem' ? `${++numberedIndex}. ` : '• ';
      children.push(
        new Paragraph({
          indent: { left: 360 },
          spacing: { before: 40, after: 40 },
          children: [new TextRun(prefix), ...runs],
        }),
      );
    } else {
      // Paragraph / text — preserve any run-level bold/italic/underline.
      const runs = inlineToRuns(b.content);
      if (runs.length) {
        children.push(new Paragraph({ spacing: { before: 60, after: 60 }, children: runs }));
      }
    }
  }

  // The `docx` library throws if a section has zero children — guard against
  // a genuinely empty storyboard rather than surfacing that as an export bug.
  if (!children.length) children.push(new Paragraph({ text: '' }));

  const doc = new Document({
    creator: 'Adapt Authoring',
    title: title && !isPlaceholderTitle(title) ? title : 'Storyboard',
    // Hidden marker so a later re-import of this exact file can detect it
    // came from Storyboard export (ADAPT-3760 re-import, spec §2) — never
    // visible in Word itself, only readable via the docx's own custom
    // document properties part.
    customProperties: buildCustomProperties(meta),
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 22 } }, // 11pt body
      },
    },
    sections: [{ children }],
  });
  return Packer.toBuffer(doc);
}

// ── Export → .pdf ────────────────────────────────────────────────────────────
// Server-side PDF via pdfkit (pure-JS, no native deps). Mirrors the docx
// structure — headings, MCQ options, embedded images.

const PDF_HEADING_SIZE = { 1: 20, 2: 16, 3: 14, 4: 12 };

async function resolveForPdf(ref, ctx) {
  try {
    const resolved = await assetResolver.resolveAnyImage(ref, ctx);
    return resolved ? await assetResolver.normalizeImageForEmbedding(resolved) : null;
  } catch (e) {
    return null;
  }
}

// Above this, an internal asset is linked-to only (no attachment) — large
// video files would otherwise bloat the PDF substantially. 15MB comfortably
// covers typical compressed audio and short video clips.
const PDF_EMBED_MAX_BYTES = 15 * 1024 * 1024;

// An internal `course/assets/<filename>` reference is never itself reachable
// from the exported file — unlike an author-pasted external URL, there's
// nothing for a PDF reader to open. Resolve it to the real asset record and
// make it reachable two ways: a clickable link to the (unauthenticated)
// asset-serve endpoint — same mechanism already used for external URLs — and,
// for anything under the size cap, an embedded file attachment so the asset
// is also openable with no network access at all. Returns true if anything
// was drawn, so the caller can fall back to the bare-text behaviour.
// Draws the "Attached below for offline access" note + the actual embedded
// file annotation. Shared by the internal-asset and external-URL paths below
// — once bytes are in hand, embedding them is identical either way.
function pdfAttachFile(doc, buffer, filename) {
  if (!buffer || !buffer.length) return;
  doc.font(PDF_FONT_ITALIC).fontSize(9).fillColor('#555')
    .text('Attached below for offline access:', { indent: 12 });
  const x = doc.x;
  const y = doc.y;
  doc.fileAnnotation(x, y, 12, 12, { src: buffer, name: filename || 'asset' });
  doc.y = y + 16;
  pdfResetText(doc);
}

async function pdfLinkInternalAsset(doc, ref, ctx) {
  let assetRec;
  try {
    assetRec = await assetResolver.resolveAnyAssetRecord(ref, ctx);
  } catch (e) {
    assetRec = null;
  }
  if (!assetRec || !assetRec._id) return false;

  let baseUrl = '';
  try {
    baseUrl = require('../../../../').getServerURL() || '';
  } catch (e) {
    /* no app context (e.g. a standalone script) — link falls back to a
       relative path below, which a reader can't follow, but the attachment
       (if small enough) still makes the file accessible. */
  }
  const relPath = `/api/asset/serve/${assetRec._id}`;
  const url = baseUrl ? `${baseUrl}${relPath}` : relPath;

  pdfResetText(doc);
  doc.font(PDF_FONT_REGULAR).fillColor('#0645AD').text(url, { link: url, underline: true, indent: 12 });
  pdfResetText(doc);

  const size = Number(assetRec.size) || 0;
  if (size > 0 && size <= PDF_EMBED_MAX_BYTES) {
    try {
      const buffer = await assetResolver.readResolvedAssetBuffer(assetRec, ctx);
      pdfAttachFile(doc, buffer, assetRec.filename);
    } catch (e) {
      /* embedding is best-effort — the link above already makes the asset
         reachable even if this fails */
    }
  }
  return true;
}

// External video/audio: the clickable link (drawn by the caller) already
// works today — this ADDS an embedded-attachment copy for offline access,
// the same mechanism as internal assets, once the bytes are actually fetched.
// Best-effort only: any failure (network, size cap, SSRF-blocked, etc.)
// leaves the existing link-only behavior as the complete, correct fallback.
async function pdfAttachExternalAsset(doc, link) {
  try {
    const result = await assetResolver.fetchExternalBytes(link, PDF_EMBED_MAX_BYTES);
    if (!result || !result.buffer.length) return;
    const filename = (() => {
      try {
        return decodeURIComponent(new URL(link).pathname.split('/').pop() || 'asset');
      } catch (e) {
        return 'asset';
      }
    })();
    pdfAttachFile(doc, result.buffer, filename);
  } catch (e) {
    /* best effort — the link already drawn by the caller remains correct */
  }
}

// ASCII-only on purpose: pdfkit's standard-14 fonts (Helvetica/etc.) encode
// text via a single-byte WinAnsi map, which has no entry for U+25CF/U+25CB.
// Those codepoints get pushed as raw 2-byte hex into a stream the reader
// decodes one byte at a time, producing mojibake ("%Ï"/"%Ë" — reproduced and
// confirmed). This only renders correctly when a Unicode TTF is registered
// (registerPdfFonts, below) — which depends on an asset from an unrelated,
// optionally-installed plugin and silently falls back to Helvetica when
// absent. Use a marker every standard font can render instead of chasing
// that dependency.
function pdfMcqBullet(correct) {
  return correct ? '[X] ' : '[ ] ';
}

// pdfkit's own `doc.image()` only ever understands raster JPEG/PNG — it has
// no SVG support at all. `svg-to-pdfkit` draws an SVG's paths directly onto
// the document using pdfkit's own vector primitives (pure JS, no native
// dependency), so an SVG renders as a real vector — not a sharp/librsvg
// rasterization — matching the Word export's native-SVG embed and no longer
// depending on sharp succeeding at all. Falls back to the rasterized
// `resolved.fallback` image (present whenever normalizeImageForEmbedding
// processed an SVG) only if svg-to-pdfkit itself can't parse this particular
// SVG (e.g. a feature it doesn't support) — same safety net as Word's.
function pdfDrawImageAt(doc, resolved, x, y, w, h) {
  if (String(resolved.type || '').toLowerCase() === 'svg') {
    try {
      const SVGtoPDF = require('svg-to-pdfkit');
      SVGtoPDF(doc, resolved.buffer.toString('utf8'), x, y, {
        width: w,
        height: h,
        preserveAspectRatio: 'xMidYMid meet',
        assumePt: true,
      });
      return true;
    } catch (e) {
      const fallbackBuffer = resolved.fallback && resolved.fallback.buffer;
      if (!fallbackBuffer) return false;
      try {
        doc.image(fallbackBuffer, x, y, { width: w, height: h });
        return true;
      } catch (e2) {
        return false;
      }
    }
  }
  try {
    doc.image(resolved.buffer, x, y, { width: w, height: h });
    return true;
  } catch (e) {
    return false;
  }
}

// Draw an image into the PDF, capped to the page's content width, aspect-
// preserving, page-break aware, and — critically — advance `doc.y` past the
// drawn image. pdfkit's `doc.image(buf, { fit: [w, h] })` does NOT move the
// text cursor, which is why subsequent `doc.text(...)` calls were rendering
// on top of the image (see storyboard PDF export overlap bug). Returns true
// on success, false if pdfkit rejected the buffer.
function pdfDrawImage(doc, resolved, opts) {
  if (!resolved || !resolved.buffer) return false;
  const options = opts || {};
  const marginL = doc.page.margins.left;
  const marginR = doc.page.margins.right;
  const marginT = doc.page.margins.top;
  const marginB = doc.page.margins.bottom;
  const contentWidth = Math.max(72, doc.page.width - marginL - marginR);
  const srcW = Math.max(1, Number(resolved.width) || 200);
  const srcH = Math.max(1, Number(resolved.height) || 200);
  // Cap at contentWidth AND at any caller-provided max (e.g. 240 for gmcq
  // option thumbs). Never up-scale — real assets keep their intrinsic size.
  const cap = Math.min(contentWidth, options.maxWidth || contentWidth, srcW);
  const w = Math.max(24, cap);
  let h = w * (srcH / srcW);
  // Guard against NaN / Infinity from unusual asset metadata — if the height
  // math goes off, fall back to a square to guarantee a valid draw.
  if (!Number.isFinite(h) || h <= 0) h = w;
  // Any text before the image (headline, description) leaves `doc.x` at the
  // left margin already — but assessment-option loops leave it at the option
  // indent. Reset explicitly so the image always sits flush at the left
  // margin and the y advance is measured from a known baseline.
  doc.x = marginL;
  // Page-break: if the image doesn't fit on the current page, break first so
  // it doesn't get clipped or overlap the footer margin.
  const pageBottom = doc.page.height - marginB;
  if (doc.y + h > pageBottom) {
    // Only break if we'd otherwise draw below the bottom margin. If the image
    // is genuinely taller than a full page (rare), scale it down instead.
    const availableFull = doc.page.height - marginT - marginB;
    if (h > availableFull) {
      const scale = availableFull / h;
      const w2 = w * scale;
      const h2 = h * scale;
      doc.addPage();
      if (!pdfDrawImageAt(doc, resolved, marginL, doc.y, w2, h2)) return false;
      doc.y += h2 + 8;
      doc.x = marginL;
      return true;
    }
    doc.addPage();
  }
  if (!pdfDrawImageAt(doc, resolved, marginL, doc.y, w, h)) {
    return false;
  }
  // Advance the text cursor PAST the image with a comfortable gap so the next
  // paragraph doesn't butt up against it. Also reset `doc.x` — the image
  // itself doesn't touch it but subsequent `.text(..., { indent })` calls
  // depend on `doc.x` being at the left margin.
  doc.y += h + 8;
  doc.x = marginL;
  return true;
}

// Reset the drawing state before writing text after images / continued runs.
// pdfkit inherits font/size/color from whatever was last set; being explicit
// avoids sneaky "continued from previous colour/size" issues after an image.
// It also snaps `doc.x` back to the left margin, because a previous `text()`
// call with `{ indent: N }` or `{ continued: true }` can leave `doc.x` in a
// mid-line position that then causes the NEXT block's first line to render
// at the wrong horizontal offset (overlapping subsequent content).
function pdfResetText(doc) {
  doc.fillColor('#111');
  doc.x = doc.page.margins.left;
}

// Break to a new page early if the current cursor is within `minSpace` of the
// page bottom — used to prevent a heading landing in the last line of a page
// with its content orphaned onto the next. Called at the top of each write
// function that will emit multi-paragraph output.
function pdfEnsureRoom(doc, minSpace) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (bottom - doc.y < minSpace) doc.addPage();
}

const PDF_FONT_REGULAR = 'StoryboardPdfRegular';
const PDF_FONT_BOLD = 'StoryboardPdfBold';
const PDF_FONT_ITALIC = 'StoryboardPdfItalic';
const PDF_FONT_BOLD_ITALIC = 'StoryboardPdfBoldItalic';

// The Unicode TTF belongs to the separately-installed/versioned
// `adapt-output-preflight` plugin, not this one — it only lands on disk via
// that plugin's own postinstall copy, so it's absent whenever that plugin is
// disabled/not installed on a given environment, or the install layout
// differs from the one path assumed here. Check a couple of plausible
// layouts before giving up, and log clearly when none match: the
// ASCII-safe-marker fix (pdfMcqBullet et al.) means a missing font no longer
// corrupts the indicator glyphs, but anything that still draws genuine
// Unicode text would silently degrade without this warning.
function findUnicodeFontPath() {
  const fs = require('fs');
  const path = require('path');
  const configuration = require('../../../../lib/configuration');
  const relFilename = 'arial-unicode-ms.ttf';
  const candidates = [
    // Current layout: plugins/output/preflight/assets/<file>, reached from
    // plugins/content/storyboard/utils/.
    path.resolve(__dirname, '../../../output/preflight/assets', relFilename),
    // Same target, resolved from the configured server root rather than a
    // fixed `__dirname` depth — survives this file moving within the plugin.
    path.join(configuration.serverRoot || process.cwd(), 'plugins/output/preflight/assets', relFilename),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function registerPdfFonts(doc) {
  const fontPath = findUnicodeFontPath();
  if (fontPath) {
    // Only one weight/style of this TTF ships with adapt-output-preflight —
    // there's no bold/italic/bold-italic face to register. Registering all
    // four style names against that same single file used to make pdfkit
    // render bold/italic/bold-italic runs visually identical to regular
    // (a TTF has no variant data pdfkit can synthesize from an alias).
    // Use it for regular text, where non-ASCII glyph coverage matters most,
    // and fall back to pdfkit's built-in Helvetica variants — genuinely
    // distinct bold/italic/bold-italic outlines, at the cost of WinAnsi-only
    // coverage — for the styled runs so bold/italic are visibly different.
    doc.registerFont(PDF_FONT_REGULAR, fontPath);
    doc.registerFont(PDF_FONT_BOLD, 'Helvetica-Bold');
    doc.registerFont(PDF_FONT_ITALIC, 'Helvetica-Oblique');
    doc.registerFont(PDF_FONT_BOLD_ITALIC, 'Helvetica-BoldOblique');
  } else {
    // Font file missing, register names with PDFKit built-in fonts as fallback
    try {
      require('../../../../lib/logger').log(
        'warn',
        'Storyboard PDF export: Unicode font (arial-unicode-ms.ttf, from the adapt-output-preflight plugin) not found — falling back to Helvetica. Non-ASCII characters outside its WinAnsi encoding will not render correctly.'
      );
    } catch (e) {
      /* logging must never block export */
    }
    doc.registerFont(PDF_FONT_REGULAR, 'Helvetica');
    doc.registerFont(PDF_FONT_BOLD, 'Helvetica-Bold');
    doc.registerFont(PDF_FONT_ITALIC, 'Helvetica-Oblique');
    doc.registerFont(PDF_FONT_BOLD_ITALIC, 'Helvetica-BoldOblique');
  }
  return true;
}

// Renders one styled run (as produced by parseRichTextHtml) using pdfkit's
// `continued: true` chaining, so multiple differently-styled runs land on
// the same line/paragraph instead of each starting a new one. Picks the
// bold/italic font variant per run (falls back to the Unicode font registered
// under all four names when the dedicated Unicode TTF isn't available — see
// registerPdfFonts); underline/strike use pdfkit's own text() options rather
// than a font switch. Subscript/superscript are approximated with a smaller
// font size (pdfkit has no native baseline-shift API for this).
function pdfRunFont(styles) {
  if (styles.bold && styles.italic) return PDF_FONT_BOLD_ITALIC;
  if (styles.bold) return PDF_FONT_BOLD;
  if (styles.italic) return PDF_FONT_ITALIC;
  return PDF_FONT_REGULAR;
}

function pdfWriteStyledRuns(doc, runs, baseFontSize, fillColor) {
  const all = (runs || []).filter((r) => r && r.text);
  if (!all.length) return;
  if (fillColor) doc.fillColor(fillColor);
  // A manual `<br>` is represented as its own run with `text: '\n'` (see
  // parseRichTextHtml). Simply excluding it from the continued-text chain
  // (as before) discarded the break entirely — "A<br>B" rendered as "AB" on
  // one line. Split into per-line groups on these markers instead, ending
  // the continued chain at each break so the next group starts on a new
  // line, same as a `continued: false` call naturally does in pdfkit.
  const lines = [[]];
  for (const run of all) {
    if (run.text === '\n') {
      lines.push([]);
      continue;
    }
    lines[lines.length - 1].push(run);
  }
  lines.forEach((lineRuns, lineIndex) => {
    if (!lineRuns.length) {
      if (lineIndex < lines.length - 1) doc.text('', { continued: false });
      return;
    }
    lineRuns.forEach((run, i) => {
      const styles = run.styles || {};
      const size = styles.subscript || styles.superscript ? Math.max(6, baseFontSize * 0.7) : baseFontSize;
      doc.font(pdfRunFont(styles)).fontSize(size).text(run.text, {
        continued: i < lineRuns.length - 1,
        underline: !!styles.underline,
        strike: !!styles.strike,
      });
    });
  });
}

// Writes a rich-text HTML field (description/instruction/question) as one
// pdfkit paragraph per source block, preserving bold/italic/underline/
// strike/subscript/superscript instead of the single flat-styled line the
// PDF path used before. Does NOT reset text state itself (fillColor/doc.x)
// before or after — callers already manage pdfResetText around their own
// calls, and this needs to apply `opts.fillColor` (e.g. the instruction's
// muted gray) without it being clobbered back to default.
function pdfWriteRichText(doc, html, opts) {
  const paragraphs = parseRichTextHtml(html);
  const fontSize = (opts && opts.fontSize) || 11;
  for (const runs of paragraphs) {
    pdfWriteStyledRuns(doc, runs, fontSize, opts && opts.fillColor);
  }
}

async function pdfWriteComponent(doc, props, ctx) {
  const kind = props.kind || 'text';
  const data = safeParse(props.data, {});
  const rawTitle = (props.title || '').trim();
  const title = isPlaceholderTitle(rawTitle) ? '' : rawTitle;
  const description = data.description ? htmlToParagraphText(data.description) : '';
  const instruction = data.instruction ? htmlToParagraphText(data.instruction) : '';
  const image = data.image || null;
  const media = data.media || null;
  const label = COMPONENT_KIND_LABEL[kind] || kind;
  const hasImage = !!(image && (image.link || image.assetId));
  const hasMedia = !!(media && media.asset && (media.asset.link || media.asset.assetId));
  const hasPoster = !!(media && media.poster && (media.poster.link || media.poster.assetId));
  const hasGroupItems =
    kind === 'groupedContent' &&
    Array.isArray(data.items) &&
    data.items.some((it) => it && (it.title || it.body || it.image));
  // NOTE: not skipped when empty — see the matching comment in
  // sbComponentToDocxParagraphs (position-matching reimport-corruption fix).

  // Reserve at least ~1 inch of vertical room for the block's header + first
  // line of content, otherwise start on a fresh page so the header doesn't
  // land on the last line by itself.
  pdfEnsureRoom(doc, 72);
  doc.moveDown(0.6);
  pdfResetText(doc);
  doc.font(PDF_FONT_BOLD).fontSize(11).text(`${label}${title ? ' - ' : ''}${title}`);
  if (description) {
    pdfResetText(doc);
    pdfWriteRichText(doc, data.description, { fontSize: 11 });
    pdfResetText(doc);
  }

  if (kind === 'image' && hasImage) {
    const resolved = await resolveForPdf(image, ctx);
    if (resolved) {
      const drew = pdfDrawImage(doc, resolved);
      if (drew) {
        if (resolved.alt) doc.font(PDF_FONT_ITALIC).fontSize(9).fillColor('#555').text(resolved.alt);
        pdfResetText(doc);
      } else {
        doc.font(PDF_FONT_ITALIC).fontSize(10).text(`[Image - ${(image && image.link) || ''}]`);
      }
    } else if (image && image.link) {
      doc.font(PDF_FONT_REGULAR).fontSize(10).fillColor('#0645AD').text(image.link, { link: image.link, underline: true });
      pdfResetText(doc);
    }
  }
  if (kind === 'video' || kind === 'audio') {
    if (hasPoster) {
      const resolved = await resolveForPdf(media.poster, ctx);
      if (resolved) pdfDrawImage(doc, resolved);
    }
    if (hasMedia) {
      const link = String((media.asset && (media.asset.link || media.asset.url)) || '');
      if (link) {
        pdfResetText(doc);
        doc.font(PDF_FONT_BOLD).fontSize(10).text(`${label} URL:`);
        if (/^https?:\/\//i.test(link)) {
          doc.font(PDF_FONT_REGULAR).fillColor('#0645AD').text(link, { link, underline: true, indent: 12 });
          pdfResetText(doc);
          await pdfAttachExternalAsset(doc, link);
        } else {
          const linked = await pdfLinkInternalAsset(doc, media.asset, ctx);
          if (!linked) doc.font(PDF_FONT_REGULAR).text(link, { indent: 12 });
        }
      }
    }
    if (media && media.transcriptText) {
      doc.moveDown(0.3);
      doc.font(PDF_FONT_BOLD).fontSize(10).text('Transcript:');
      doc.font(PDF_FONT_REGULAR).fontSize(10).text(String(media.transcriptText));
    }
  }
  if (hasGroupItems) {
    for (const item of data.items) {
      if (!item) continue;
      const t = String(item.title || '').trim();
      const b = String(item.body || '').trim();
      if (!t && !b && !item.image) continue;
      doc.moveDown(0.2);
      if (t) doc.font(PDF_FONT_BOLD).fontSize(10).text(t);
      // See the matching DOCX-side comment: `item.body` is rich-text HTML,
      // not plain text — printing it verbatim via doc.text() rendered the
      // literal "<p>...</p>" tags instead of formatted paragraphs.
      if (b) {
        pdfResetText(doc);
        pdfWriteRichText(doc, b, { fontSize: 10 });
        pdfResetText(doc);
      }
      if (item.image) {
        // eslint-disable-next-line no-await-in-loop
        const resolved = await resolveForPdf({ link: item.image, assetId: item.imageAssetId }, ctx);
        if (resolved) pdfDrawImage(doc, resolved, { maxWidth: 320 });
      }
    }
  }
  if (instruction) {
    doc.moveDown(0.3);
    pdfResetText(doc);
    // See the matching DOCX-side comment: a bold label (not forced italic
    // content styling) distinguishes the section without destroying the
    // author's own formatting, and doubles as the reimport marker.
    doc.font(PDF_FONT_BOLD).fontSize(10).text('Instruction:');
    pdfWriteRichText(doc, data.instruction, { fontSize: 10, fillColor: '#555' });
    pdfResetText(doc);
  }
  doc.moveDown(0.8);
}

async function pdfWriteAssessment(doc, props, ctx) {
  const kind = props.kind || 'mcq';
  const data = safeParse(props.data, {});
  const rawTitle = (props.title || '').trim();
  const title = isPlaceholderTitle(rawTitle) ? '' : rawTitle;
  const question = data.question ? htmlToParagraphText(data.question) : '';
  const options = Array.isArray(data.options) ? data.options.filter((o) => o && o.text) : [];
  const items = Array.isArray(data.items) ? data.items.filter(Boolean) : [];
  const pairs = Array.isArray(data.pairs) ? data.pairs.filter((p) => p && (p.prompt || p.answer)) : [];
  const answers = Array.isArray(data.answers) ? data.answers.filter(Boolean) : [];
  const fb = data.feedback || {};
  // NOTE: not skipped when empty — see the matching comment in
  // sbComponentToDocxParagraphs (position-matching reimport-corruption fix).
  // Reserve ~1.2 in of vertical room so a question header + first option
  // isn't orphaned at the page bottom.
  pdfEnsureRoom(doc, 90);
  doc.moveDown(0.6);
  pdfResetText(doc);
  const kindLabel = ASSESSMENT_KIND_LABEL[kind] || 'Question';
  // See docx-side comment: Title is the primary header, Body renders as its
  // own paragraph only when it isn't already the header (no duplication).
  // Collapse paragraph breaks for the single-line header (consistent with
  // the docx path, even though pdfkit's text() would wrap them fine too).
  const headerText = title || question.replace(/\n+/g, ' ').trim();
  const showQuestionParagraph = !!question && question !== headerText;
  doc.font(PDF_FONT_BOLD).fontSize(11).text(`${kindLabel}${headerText ? ' - ' : ''}${headerText}`);
  if (showQuestionParagraph) {
    pdfResetText(doc);
    pdfWriteRichText(doc, data.question, { fontSize: 11 });
    pdfResetText(doc);
  }

  if (kind === 'mcq' || kind === 'gmcq' || kind === 'checklist') {
    for (const opt of options) {
      pdfResetText(doc);
      doc.font(opt.correct ? PDF_FONT_BOLD : PDF_FONT_REGULAR).fontSize(11)
        .text(`${pdfMcqBullet(opt.correct)}${stripHtml(opt.text)}`, { indent: 12 });
      if (kind === 'gmcq' && (opt.image || opt.imageAssetId)) {
        // eslint-disable-next-line no-await-in-loop
        const resolved = await resolveForPdf({ link: opt.image, assetId: opt.imageAssetId, alt: opt.text }, ctx);
        if (resolved) pdfDrawImage(doc, resolved, { maxWidth: 240 });
      }
      const pdfOptFb = stripHtml(opt.feedback);
      if (pdfOptFb) doc.font(PDF_FONT_ITALIC).fontSize(10).fillColor('#555').text(pdfOptFb, { indent: 24 });
      pdfResetText(doc);
    }
    if (kind === 'checklist' && data.selectable) {
      pdfResetText(doc);
      doc.font(PDF_FONT_BOLD).fontSize(10).text(`Selectable: ${data.selectable}`);
    }
  } else if (kind === 'matching') {
    for (const p of pairs) {
      // Get the correct option from options array (if available)
      const correctOption = Array.isArray(p.options) ? p.options.find((opt) => opt && opt.correct) : null;
      const answerText = correctOption ? String(correctOption.text || '') : '';
      doc.font(PDF_FONT_REGULAR).fontSize(11).text(`- ${p.prompt || ''}  ->  ${answerText}`, { indent: 12 });
    }
  } else if (kind === 'reorder') {
    items.forEach((it, i) => doc.font(PDF_FONT_REGULAR).fontSize(11).text(`${i + 1}. ${it}`, { indent: 12 }));
  } else if (kind === 'textInput') {
    for (const ans of answers) doc.font(PDF_FONT_REGULAR).fontSize(11).text(`- Accepted answer: ${ans}`, { indent: 12 });
  } else if (kind === 'slider' && data.slider) {
    const s = data.slider;
    doc.font(PDF_FONT_REGULAR).fontSize(11).text(
      `Range: ${s.min ?? 0}-${s.max ?? 10} step ${s.step ?? 1}, correct answer ${s.correct ?? ''}`,
      { indent: 12 },
    );
  }

  const FEEDBACK_LABELS = [
    ['correct', 'Correct'],
    ['incorrect', 'Incorrect'],
    ['incorrectNotFinal', 'Incorrect - not final'],
    ['partlyCorrectFinal', 'Partly correct - final'],
    ['partlyCorrectNotFinal', 'Partly correct - not final'],
  ];
  const fbLines = FEEDBACK_LABELS
    .map(([k, lbl]) => [k, lbl, stripHtml(fb[k])])
    .filter(([, , v]) => v);
  if (fbLines.length) {
    doc.moveDown(0.4);
    for (const [, lbl, value] of fbLines) {
      pdfResetText(doc);
      // Render label + value as one string with the label in bold and the
      // value indented on the next line. Two separate paragraphs is more
      // robust than pdfkit's `continued: true` chain, which can leave the
      // cursor mid-line and cause the next feedback row to overlap.
      doc.font(PDF_FONT_BOLD).fontSize(10).text(`${lbl}:`);
      doc.font(PDF_FONT_REGULAR).fontSize(10).text(value, { indent: 12 });
    }
  }
  const footer = ASSESSMENT_FOOTER[kind];
  if (footer) {
    doc.moveDown(0.4);
    pdfResetText(doc);
    doc.font(PDF_FONT_ITALIC).fontSize(10).fillColor('#555').text(footer);
    pdfResetText(doc);
  }
  doc.moveDown(0.8);
}

// Draw a bordered grid for a native BlockNote `table` block's
// `{type:'tableContent', rows:[{cells:[...]}]}` content — pdfkit has no table
// widget, so rows/columns/borders are drawn manually, page-break aware.
function pdfWriteTable(doc, content) {
  const rows = content && Array.isArray(content.rows) ? content.rows : [];
  if (!rows.length) return;
  const marginL = doc.page.margins.left;
  const marginR = doc.page.margins.right;
  const contentWidth = Math.max(72, doc.page.width - marginL - marginR);
  const colCount = Math.max(1, ...rows.map((r) => (Array.isArray(r.cells) ? r.cells.length : 0)));
  const colWidth = contentWidth / colCount;
  const padding = 4;
  const fontSize = 10;

  pdfResetText(doc);
  doc.moveDown(0.3);
  for (const row of rows) {
    const cells = Array.isArray(row.cells) ? row.cells : [];
    const texts = [];
    for (let c = 0; c < colCount; c++) texts.push(inlineToText(tableCellRuns(cells[c])));

    doc.font(PDF_FONT_REGULAR).fontSize(fontSize);
    const cellHeights = texts.map((t) => doc.heightOfString(t || ' ', { width: colWidth - padding * 2 }));
    const rowHeight = Math.max(fontSize + padding * 2, ...cellHeights.map((h) => h + padding * 2));

    const pageBottom = doc.page.height - doc.page.margins.bottom;
    if (doc.y + rowHeight > pageBottom) doc.addPage();

    const rowY = doc.y;
    let x = marginL;
    for (let c = 0; c < colCount; c++) {
      doc.rect(x, rowY, colWidth, rowHeight).stroke('#999');
      doc
        .fillColor('#111')
        .font(PDF_FONT_REGULAR)
        .fontSize(fontSize)
        .text(texts[c] || '', x + padding, rowY + padding, { width: colWidth - padding * 2, height: rowHeight - padding * 2 });
      x += colWidth;
    }
    doc.x = marginL;
    doc.y = rowY + rowHeight;
  }
  doc.moveDown(0.4);
}

async function blocksToPdf(blocks, title, ctx) {
  const PDFDocument = require('pdfkit');
  // `bufferPages: true` lets pdfkit compute layout on a per-page basis so
  // our explicit page-break checks stay in sync. `margin: 56` gives ~0.75in
  // margins on A4. `lineGap: 2` adds 2pt between wrapped lines — small
  // enough to look natural but enough to prevent descender/ascender
  // collisions when adjacent paragraphs share a font.
  const doc = new PDFDocument({ margin: 56, size: 'A4', autoFirstPage: true, bufferPages: true });
  doc.lineGap(2);
  registerPdfFonts(doc);
  const chunks = [];
  const done = new Promise((resolve, reject) => {
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  if (title && !isPlaceholderTitle(title)) {
    doc.font(PDF_FONT_BOLD).fontSize(24).fillColor('#111').text(title);
    doc.moveDown(1.0);
  }

  // Ordered-list numbering — same run-based counter as the docx path.
  let numberedIndex = 0;
  for (const b of Array.isArray(blocks) ? blocks : []) {
    if (!b || !b.type) continue;
    if (b.type !== 'numberedListItem') numberedIndex = 0;
    const props = b.props || {};
    // Reset color between blocks so a lingering fillColor from an image alt
    // or feedback row doesn't bleed into the next block's heading/body.
    pdfResetText(doc);
    if (b.type === 'heading') {
      // Always write the heading — see the matching comment on the DOCX
      // path above (position-matching reimport-corruption fix). A
      // level-appropriate fallback is used only when genuinely blank.
      const text = inlineToText(b.content).trim() || HEADING_LEVEL_FALLBACK[props.level] || 'Untitled';
      const size = PDF_HEADING_SIZE[props.level] || 12;
      // Keep headings with their following block by breaking to a new page
      // when there's no room for at least ~2 lines below the heading.
      const marginB = doc.page.margins.bottom;
      const roomLeft = doc.page.height - marginB - doc.y;
      if (roomLeft < size * 3) doc.addPage();
      doc.moveDown(0.4);
      doc.font(PDF_FONT_BOLD).fontSize(size).text(text);
      doc.moveDown(0.2);
    } else if (b.type === 'sbAssessment') {
      // eslint-disable-next-line no-await-in-loop
      await pdfWriteAssessment(doc, props, ctx);
    } else if (b.type === 'sbComponent') {
      // eslint-disable-next-line no-await-in-loop
      await pdfWriteComponent(doc, props, ctx);
    } else if (b.type === 'sbPlaceholder') {
      pdfResetText(doc);
      doc.font(PDF_FONT_BOLD).fontSize(11).text(`[${props.label || 'Placeholder'}] ${props.title || ''}`);
      doc.moveDown(0.3);
    } else if (b.type === 'table') {
      pdfWriteTable(doc, b.content);
    } else if (b.type === 'bulletListItem' || b.type === 'numberedListItem') {
      const text = inlineToText(b.content);
      if (text) {
        const prefix = b.type === 'numberedListItem' ? `${++numberedIndex}. ` : '- ';
        doc.font(PDF_FONT_REGULAR).fontSize(11).text(`${prefix}${text}`, { indent: 12 });
      }
    } else {
      const text = inlineToText(b.content);
      if (text) {
        doc.font(PDF_FONT_REGULAR).fontSize(11).text(text);
        doc.moveDown(0.3);
      }
    }
  }
  doc.end();
  return done;
}

// ── Import → BlockNote blocks ────────────────────────────────────────────────

// High-fidelity docx import (ADAPT-3760): Mammoth → sanitize → structured
// NormalizedDocument (headings/paragraphs/lists/tables/images/inline
// formatting all preserved) → BlockNote blocks. See utils/normalize/ for the
// actual parsing/conversion — this is a thin delegate so there's a single
// import code path per spec ("extend the existing Mammoth import").
async function wordToBlocks(buffer, meta) {
  const normalizedDocument = await parseDocxToNormalizedDocument(buffer, meta);
  const blocks = normalizedDocumentToBlockNote(normalizedDocument);
  return { normalizedDocument, blocks };
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

// PDF has no real structure (no headings/lists/tables in the format itself)
// — pdfNormalizer.js reconstructs it from layout (font size, bullet/number
// prefixes, image position). See utils/normalize/ for the actual parsing —
// this is a thin delegate, same shape as wordToBlocks.
async function pdfToBlocks(buffer, meta) {
  const normalizedDocument = await parsePdfToNormalizedDocument(buffer, meta);
  const blocks = normalizedDocumentToBlockNote(normalizedDocument);
  return { normalizedDocument, blocks };
}

module.exports = { blocksToDocx, blocksToPdf, wordToBlocks, pptxToBlocks, pdfToBlocks };
