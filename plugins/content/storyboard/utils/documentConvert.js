// Storyboard ⇄ document conversion (ADAPT-3760/3785, Phase 7 / AC10).
//
// Export: BlockNote document → Word (.docx) via the `docx` lib. Embeds real
//         asset bytes for image / video-poster references (see assetResolver)
//         and renders MCQ / checklist / matching / reorder assessments with a
//         proper option list + per-option feedback + whole-question feedback
//         + submit instruction, matching the Storyboard's own Preview.
// Import: .docx (mammoth) / .pptx (adm-zip, best-effort) / .pdf (pdf-parse if
//         installed) → BlockNote blocks, preserving heading hierarchy.

const {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
  ImageRun,
  ExternalHyperlink,
  AlignmentType,
} = require('docx');

const assetResolver = require('./assetResolver');

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

// Push an image ref (already resolved via assetResolver) as an ImageRun. Falls
// back to a bracketed text reference if resolution failed (external URL, etc.).
async function pushImageRef(children, ref, label, ctx) {
  try {
    const resolved = await assetResolver.resolveAnyImage(ref, ctx);
    if (resolved) {
      children.push(
        new Paragraph({
          spacing: { before: 120, after: 120 },
          children: [
            new ImageRun({
              data: resolved.buffer,
              type: resolved.type,
              transformation: { width: resolved.width, height: resolved.height },
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
    /* fall through to text reference */
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

  const description = data.description ? String(data.description).trim() : '';
  const instruction = data.instruction ? String(data.instruction).trim() : '';
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

  // A brand-new component with no title AND no data is scaffolding only —
  // skip it entirely so the docx doesn't fill with empty "Text —" headers.
  if (
    !title &&
    !description &&
    !instruction &&
    !hasGroupItems &&
    !hasFormFields &&
    !hasImageAsset &&
    !hasMediaAsset &&
    !hasMediaPoster
  ) {
    return;
  }

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

  if (description) pushTextParagraphs(children, description);

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
      if (b) pushTextParagraphs(children, b);
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

  if (instruction) pushTextParagraphs(children, instruction, { italic: true });
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
  const question = data.question ? String(data.question).trim() : '';
  const options = Array.isArray(data.options) ? data.options.filter((o) => o && o.text) : [];
  const items = Array.isArray(data.items) ? data.items.filter(Boolean) : [];
  const pairs = Array.isArray(data.pairs) ? data.pairs.filter((p) => p && (p.prompt || p.answer)) : [];
  const answers = Array.isArray(data.answers) ? data.answers.filter(Boolean) : [];
  const fb = data.feedback || {};

  // Skip an assessment card that carries no authored content at all.
  if (
    !title &&
    !question &&
    !options.length &&
    !items.length &&
    !pairs.length &&
    !answers.length &&
    !(data.slider && data.slider.correct != null)
  ) {
    return;
  }

  // Question Title/Body resolution (PR review — no duplicated text):
  //   • The block-level Title is the primary header; when the author left it
  //     empty the question Body stands in as the header.
  //   • The question Body is emitted as its own paragraph only when it isn't
  //     already the header text — so the same sentence never renders twice.
  const headerText = title || question;
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
  if (showQuestionParagraph) pushTextParagraphs(children, question);

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
      children.push(
        new Paragraph({
          indent: { left: 360 },
          spacing: { before: 40, after: 20 },
          children: [
            new TextRun({ text: '• ' }),
            new TextRun({ text: String(p.prompt || '') }),
            new TextRun({ text: '  →  ', bold: true }),
            new TextRun({ text: String(p.answer || ''), italics: true }),
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
}

async function blocksToDocx(blocks, title, ctx) {
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
      const text = inlineToText(b.content);
      // Skip empty headings and headings whose only text is a schema default —
      // legacy storyboard records baked those in as heading content before the
      // projector filtered them out.
      if (isPlaceholderTitle(text)) continue;
      const level = HEADING_LEVEL[props.level] || HeadingLevel.HEADING_4;
      const spacing = HEADING_SPACING[props.level] || HEADING_SPACING[4];
      children.push(new Paragraph({ heading: level, spacing, children: inlineToRuns(b.content) }));
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
    return await assetResolver.resolveAnyImage(ref, ctx);
  } catch (e) {
    return null;
  }
}

function pdfMcqBullet(correct) {
  return correct ? '● ' : '○ ';
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
      try { doc.image(resolved.buffer, marginL, doc.y, { width: w2, height: h2 }); }
      catch (e) { return false; }
      doc.y += h2 + 8;
      doc.x = marginL;
      return true;
    }
    doc.addPage();
  }
  try {
    doc.image(resolved.buffer, marginL, doc.y, { width: w, height: h });
  } catch (e) {
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

async function pdfWriteComponent(doc, props, ctx) {
  const kind = props.kind || 'text';
  const data = safeParse(props.data, {});
  const rawTitle = (props.title || '').trim();
  const title = isPlaceholderTitle(rawTitle) ? '' : rawTitle;
  const description = data.description ? String(data.description).trim() : '';
  const instruction = data.instruction ? String(data.instruction).trim() : '';
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
  if (!title && !description && !instruction && !hasImage && !hasMedia && !hasPoster && !hasGroupItems) return;

  // Reserve at least ~1 inch of vertical room for the block's header + first
  // line of content, otherwise start on a fresh page so the header doesn't
  // land on the last line by itself.
  pdfEnsureRoom(doc, 72);
  doc.moveDown(0.6);
  pdfResetText(doc);
  doc.font('Helvetica-Bold').fontSize(11).text(`${label}${title ? ' — ' : ''}${title}`);
  if (description) {
    pdfResetText(doc);
    doc.font('Helvetica').fontSize(11).text(description, { paragraphGap: 4 });
  }

  if (kind === 'image' && hasImage) {
    const resolved = await resolveForPdf(image, ctx);
    if (resolved) {
      const drew = pdfDrawImage(doc, resolved);
      if (drew) {
        if (resolved.alt) doc.font('Helvetica-Oblique').fontSize(9).fillColor('#555').text(resolved.alt);
        pdfResetText(doc);
      } else {
        doc.font('Helvetica-Oblique').fontSize(10).text(`[Image — ${(image && image.link) || ''}]`);
      }
    } else if (image && image.link) {
      doc.font('Helvetica').fontSize(10).fillColor('#0645AD').text(image.link, { link: image.link, underline: true });
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
        doc.font('Helvetica-Bold').fontSize(10).text(`${label} URL:`);
        if (/^https?:\/\//i.test(link)) {
          doc.font('Helvetica').fillColor('#0645AD').text(link, { link, underline: true, indent: 12 });
          pdfResetText(doc);
        } else {
          doc.font('Helvetica').text(link, { indent: 12 });
        }
      }
    }
    if (media && media.transcriptText) {
      doc.moveDown(0.3);
      doc.font('Helvetica-Bold').fontSize(10).text('Transcript:');
      doc.font('Helvetica').fontSize(10).text(String(media.transcriptText));
    }
  }
  if (hasGroupItems) {
    for (const item of data.items) {
      if (!item) continue;
      const t = String(item.title || '').trim();
      const b = String(item.body || '').trim();
      if (!t && !b && !item.image) continue;
      doc.moveDown(0.2);
      if (t) doc.font('Helvetica-Bold').fontSize(10).text(t);
      if (b) doc.font('Helvetica').fontSize(10).text(b);
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
    doc.font('Helvetica-Oblique').fontSize(10).fillColor('#555').text(instruction);
    pdfResetText(doc);
  }
  doc.moveDown(0.8);
}

async function pdfWriteAssessment(doc, props, ctx) {
  const kind = props.kind || 'mcq';
  const data = safeParse(props.data, {});
  const rawTitle = (props.title || '').trim();
  const title = isPlaceholderTitle(rawTitle) ? '' : rawTitle;
  const question = data.question ? String(data.question).trim() : '';
  const options = Array.isArray(data.options) ? data.options.filter((o) => o && o.text) : [];
  const items = Array.isArray(data.items) ? data.items.filter(Boolean) : [];
  const pairs = Array.isArray(data.pairs) ? data.pairs.filter((p) => p && (p.prompt || p.answer)) : [];
  const answers = Array.isArray(data.answers) ? data.answers.filter(Boolean) : [];
  const fb = data.feedback || {};
  if (
    !title &&
    !question &&
    !options.length &&
    !items.length &&
    !pairs.length &&
    !answers.length &&
    !(data.slider && data.slider.correct != null)
  ) {
    return;
  }
  // Reserve ~1.2 in of vertical room so a question header + first option
  // isn't orphaned at the page bottom.
  pdfEnsureRoom(doc, 90);
  doc.moveDown(0.6);
  pdfResetText(doc);
  const kindLabel = ASSESSMENT_KIND_LABEL[kind] || 'Question';
  // See docx-side comment: Title is the primary header, Body renders as its
  // own paragraph only when it isn't already the header (no duplication).
  const headerText = title || question;
  const showQuestionParagraph = !!question && question !== headerText;
  doc.font('Helvetica-Bold').fontSize(11).text(`${kindLabel}${headerText ? ' — ' : ''}${headerText}`);
  if (showQuestionParagraph) {
    doc.font('Helvetica').fontSize(11);
    pdfResetText(doc);
    doc.text(question, { paragraphGap: 3 });
  }

  if (kind === 'mcq' || kind === 'gmcq' || kind === 'checklist') {
    for (const opt of options) {
      pdfResetText(doc);
      doc.font(opt.correct ? 'Helvetica-Bold' : 'Helvetica').fontSize(11)
        .text(`${pdfMcqBullet(opt.correct)}${stripHtml(opt.text)}`, { indent: 12 });
      if (kind === 'gmcq' && (opt.image || opt.imageAssetId)) {
        // eslint-disable-next-line no-await-in-loop
        const resolved = await resolveForPdf({ link: opt.image, assetId: opt.imageAssetId, alt: opt.text }, ctx);
        if (resolved) pdfDrawImage(doc, resolved, { maxWidth: 240 });
      }
      const pdfOptFb = stripHtml(opt.feedback);
      if (pdfOptFb) doc.font('Helvetica-Oblique').fontSize(10).fillColor('#555').text(pdfOptFb, { indent: 24 });
      pdfResetText(doc);
    }
    if (kind === 'checklist' && data.selectable) {
      pdfResetText(doc);
      doc.font('Helvetica-Bold').fontSize(10).text(`Selectable: ${data.selectable}`);
    }
  } else if (kind === 'matching') {
    for (const p of pairs) {
      doc.font('Helvetica').fontSize(11).text(`• ${p.prompt || ''}  →  ${p.answer || ''}`, { indent: 12 });
    }
  } else if (kind === 'reorder') {
    items.forEach((it, i) => doc.font('Helvetica').fontSize(11).text(`${i + 1}. ${it}`, { indent: 12 }));
  } else if (kind === 'textInput') {
    for (const ans of answers) doc.font('Helvetica').fontSize(11).text(`• Accepted answer: ${ans}`, { indent: 12 });
  } else if (kind === 'slider' && data.slider) {
    const s = data.slider;
    doc.font('Helvetica').fontSize(11).text(
      `Range: ${s.min ?? 0}–${s.max ?? 10} step ${s.step ?? 1}, correct answer ${s.correct ?? ''}`,
      { indent: 12 },
    );
  }

  const FEEDBACK_LABELS = [
    ['correct', 'Correct'],
    ['incorrect', 'Incorrect'],
    ['incorrectNotFinal', 'Incorrect — not final'],
    ['partlyCorrectFinal', 'Partly correct — final'],
    ['partlyCorrectNotFinal', 'Partly correct — not final'],
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
      doc.font('Helvetica-Bold').fontSize(10).text(`${lbl}:`);
      doc.font('Helvetica').fontSize(10).text(value, { indent: 12 });
    }
  }
  const footer = ASSESSMENT_FOOTER[kind];
  if (footer) {
    doc.moveDown(0.4);
    pdfResetText(doc);
    doc.font('Helvetica-Oblique').fontSize(10).fillColor('#555').text(footer);
    pdfResetText(doc);
  }
  doc.moveDown(0.8);
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
  const chunks = [];
  const done = new Promise((resolve, reject) => {
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  if (title && !isPlaceholderTitle(title)) {
    doc.font('Helvetica-Bold').fontSize(24).fillColor('#111').text(title);
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
      const text = inlineToText(b.content);
      if (isPlaceholderTitle(text)) continue;
      const size = PDF_HEADING_SIZE[props.level] || 12;
      // Keep headings with their following block by breaking to a new page
      // when there's no room for at least ~2 lines below the heading.
      const marginB = doc.page.margins.bottom;
      const roomLeft = doc.page.height - marginB - doc.y;
      if (roomLeft < size * 3) doc.addPage();
      doc.moveDown(0.4);
      doc.font('Helvetica-Bold').fontSize(size).text(text);
      doc.moveDown(0.2);
    } else if (b.type === 'sbAssessment') {
      // eslint-disable-next-line no-await-in-loop
      await pdfWriteAssessment(doc, props, ctx);
    } else if (b.type === 'sbComponent') {
      // eslint-disable-next-line no-await-in-loop
      await pdfWriteComponent(doc, props, ctx);
    } else if (b.type === 'sbPlaceholder') {
      pdfResetText(doc);
      doc.font('Helvetica-Bold').fontSize(11).text(`[${props.label || 'Placeholder'}] ${props.title || ''}`);
      doc.moveDown(0.3);
    } else if (b.type === 'bulletListItem' || b.type === 'numberedListItem') {
      const text = inlineToText(b.content);
      if (text) {
        const prefix = b.type === 'numberedListItem' ? `${++numberedIndex}. ` : '• ';
        doc.font('Helvetica').fontSize(11).text(`${prefix}${text}`, { indent: 12 });
      }
    } else {
      const text = inlineToText(b.content);
      if (text) {
        doc.font('Helvetica').fontSize(11).text(text);
        doc.moveDown(0.3);
      }
    }
  }
  doc.end();
  return done;
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
