// NormalizedDocument -> BlockNote blocks (ADAPT-3760 storyboard import).
//
// Kept independent of any parser: takes only the plain NormalizedDocument
// JSON shape (see docxNormalizer.js / pdfNormalizer.js / pptxNormalizer.js)
// and returns valid BlockNote block JSON matching the storyboard editor's
// registered schema.
//
// `heading`, `paragraph`, `bulletListItem`, `numberedListItem`, and `table`
// all become native BlockNote blocks (a real visual table for `table` — see
// its case below) — all of them are understood by storyboardGeneration.ts's
// parseDocToTree, which folds a list/table into whichever Text component
// encloses it (these used to become a separate
// `sbComponent(kind:'groupedContent')` card, i.e. an Accordion, which is not
// what a plain Word bullet list or table is).
// Everything else (images, a paragraph that's just a link to an external
// video, a detected quiz question) is emitted as an `sbComponent`/
// `sbAssessment` card instead: a native `image` block generates with no
// actual image reference wired up (only `sbComponent(kind:'image')` cards
// carry that through), and there is no native block type for video/quiz
// content at all. Using the same component kinds resolveAdaptComponent
// already knows about (componentMapping.ts) is both the fix for that data
// loss and the "map content to an appropriate component" behavior itself.
const { randomUUID } = require('crypto');

const MAX_HEADING_LEVEL = 4; // matches STORYBOARD_HEADING_LEVELS in new-ui-source

function nextId(prefix) {
  return `${prefix}-${randomUUID()}`;
}

/** NormalizedInlineRun[] -> BlockNote inline content array. */
function inlineToBlockNote(inline) {
  if (!Array.isArray(inline)) return [];
  const out = [];
  for (const run of inline) {
    if (!run || !run.text) continue;
    const node = { type: 'text', text: run.text, styles: {} };
    if (run.bold) node.styles.bold = true;
    if (run.italic) node.styles.italic = true;
    if (run.underline) node.styles.underline = true;
    if (run.strike) node.styles.strike = true;
    if (run.subscript) node.styles.subscript = true;
    if (run.superscript) node.styles.superscript = true;
    if (run.link) {
      out.push({ type: 'link', href: run.link, content: [{ type: 'text', text: run.text, styles: node.styles }] });
      continue;
    }
    out.push(node);
  }
  return out;
}

// Split a NormalizedInlineRun[] into groups at each hard line break (a run
// with text === '\n', from a Word manual line break / mammoth's <br>).
// BlockNote (0.52) has no native "soft break within one paragraph" node — its
// text nodes are plain strings, so a literal '\n' reaching one is just
// whitespace and collapses on render (the line break vanishes and everything
// merges onto one visual line). Giving each line its own block instead keeps
// the break visible AND keeps each line's own bold/italic/etc. untouched
// (styles are per-run already, so splitting never touches them).
function splitInlineOnBreaks(inline) {
  const groups = [[]];
  for (const run of inline || []) {
    if (run && run.text === '\n') {
      groups.push([]);
      continue;
    }
    groups[groups.length - 1].push(run);
  }
  return groups;
}

function hasVisibleText(inline) {
  return Array.isArray(inline) && inline.some((r) => r && r.text && r.text.trim());
}

function inlineToPlainText(inline) {
  return Array.isArray(inline) ? inline.map((r) => (r && r.text) || '').join('') : '';
}

// Word can't embed a real playable video — a hyperlink to an external URL is
// the only way an author can reference one. Recognized: YouTube/Vimeo watch
// links (matches mediaMapping.ts's detectMediaType on the generation side)
// and a direct link to a video file.
const VIDEO_HOST_PATTERN = /youtube\.com|youtu\.be|vimeo\.com/i;
const VIDEO_FILE_PATTERN = /\.(mp4|webm|ogv|mov)(?:[?#]|$)/i;
function isVideoUrl(url) {
  return !!url && (VIDEO_HOST_PATTERN.test(url) || VIDEO_FILE_PATTERN.test(url));
}

// Best-effort detection of a plain-text MCQ authored directly in Word: a
// paragraph starting "Q:"/"Q1:"/"Question 2." followed immediately by 2+
// paragraphs starting "A)"/"B."/etc, where the correct option's text is
// entirely bold (real Word bold formatting) — the only structural signal an
// organically-authored (not previously exported from this tool) Word doc can
// give for "this is a quiz question with this answer marked correct".
const QUESTION_PREFIX = /^\s*(?:Q(?:uestion)?\s*\d*)\s*[:.)]\s*/i;
const OPTION_PREFIX = /^\s*[A-Za-z]\s*[).]\s*/;

// Strips a leading "Q:"/"A)"-style prefix from a paragraph's inline runs,
// returning the REMAINING runs (question/option body only, styles intact) —
// or null if the paragraph's own first run doesn't start with that prefix.
function stripLeadingPrefix(inline, pattern) {
  if (!Array.isArray(inline) || !inline.length) return null;
  const first = inline[0];
  const text = (first && first.text) || '';
  const m = text.match(pattern);
  if (!m) return null;
  const rest = text.slice(m[0].length);
  const restRuns = [];
  if (rest.trim()) restRuns.push({ ...first, text: rest });
  restRuns.push(...inline.slice(1));
  return restRuns;
}

function isEntirelyBold(inline) {
  const visible = (inline || []).filter((r) => r && r.text && r.text.trim());
  return visible.length > 0 && visible.every((r) => r.bold);
}

// Mirrors documentConvert.js's COMPONENT_KIND_LABEL / ASSESSMENT_KIND_LABEL —
// used below only to strip the "{label} — " prefix off a card's rendered
// title/header line. Duplicated rather than shared, same as other small
// constant maps split across the storyboard import/export pair (e.g.
// inputTypeFor in storyboardGeneration.ts vs. adaptAuthoring.ts).
const RECONCILE_COMPONENT_LABEL = {
  text: 'Text', groupedContent: 'Grouped Content', image: 'Image', video: 'Video',
  audio: 'Audio', h5p: 'H5P', laerdalForm: 'Laerdal Form', assessmentResult: 'Assessment Result',
};
const RECONCILE_ASSESSMENT_LABEL = {
  mcq: 'MCQ', gmcq: 'Graphic MCQ', matching: 'Matching', reorder: 'Sentence Reordering',
  textInput: 'Text Input', slider: 'Slider', checklist: 'Checklist',
};

function escapeHtmlText(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Converts a NormalizedInlineRun[] (the {text, bold, italic, underline,
// strike, subscript, superscript, link} shape docxNormalizer.js produces)
// into an HTML string preserving formatting. `description`/`instruction`/
// `question` are rich-text (BasicRichTextEditor) fields stored as HTML —
// re-deriving them as PLAIN text (as an earlier version of this function
// did) silently dropped bold/italic/underline/strike/subscript/superscript
// on every reimport. A literal '\n' run (a manual Word line break WITHIN one
// paragraph, from extractInline's <br> handling) becomes a real <br>.
function inlineRunsToHtml(inline) {
  return (inline || [])
    .map((run) => {
      if (!run) return '';
      if (run.text === '\n') return '<br>';
      let html = escapeHtmlText(run.text || '');
      if (!html) return '';
      if (run.subscript) html = `<sub>${html}</sub>`;
      if (run.superscript) html = `<sup>${html}</sup>`;
      if (run.strike) html = `<s>${html}</s>`;
      if (run.underline) html = `<u>${html}</u>`;
      if (run.italic) html = `<em>${html}</em>`;
      if (run.bold) html = `<strong>${html}</strong>`;
      return html;
    })
    .join('');
}

// Wraps each paragraph's rich-formatted HTML in <p>...</p>, matching the
// rich-text editor's own multi-paragraph convention — a literal '\n' joining
// paragraphs (as an earlier version of this function did) is NOT a real
// paragraph break once it reaches dangerouslySetInnerHTML: HTML collapses
// bare whitespace, so the break was silently lost on redisplay even though
// the underlying string still "looked" multi-line in raw JSON.
function paragraphsToHtml(paragraphItems) {
  return paragraphItems
    .map((p) => inlineRunsToHtml(p.inline))
    .filter((html) => html.trim())
    .map((html) => `<p>${html}</p>`)
    .join('');
}

// A STRUCTURAL line in an sbComponent card's visible prose (mirrors
// sbComponentToDocxParagraphs) — used to recognize where the description
// paragraphs end, by the LITERAL label text the exporter writes, not by
// formatting. An earlier version of this used "fully bold"/"fully italic"/
// "contains a link" as the signal, but all three are formatting an author
// can legitimately apply inside their own description (a bolded opening
// sentence, an italicized aside, an inline link) — treating them as
// structural silently discarded the real edit and kept the frozen marker
// value instead. `altText`, when given, additionally recognizes the italic
// alt-text caption pushImageRef writes after an image/poster (compared by
// exact value, not by its italic styling, since that's the one place this
// exporter still relies on styling rather than a label).
function isComponentStructuralLine(text, altText) {
  if (/^(?:Video|Audio) URL:/.test(text)) return true;
  if (/^Transcript:/.test(text)) return true;
  if (/^Instruction:/.test(text)) return true;
  if (text.indexOf('•') === 0) return true;
  if (altText && text === altText) return true;
  return false;
}

// Collects every paragraph from `startIndex` that belongs to the question
// body — NOT an option/feedback/etc. line (isAssessmentStructuralLine) —
// mirroring the sbComponent description loop above: pushRichTextParagraphs
// can write an arbitrary number of paragraphs for a multi-paragraph or
// richly-formatted question, and peeking at only `paragraphs[startIndex]`
// (an earlier version of this code) truncated every paragraph after the
// first and ignored bold/italic within it.
function collectAssessmentQuestionParagraphs(paragraphs, startIndex) {
  const out = [];
  for (let i = startIndex; i < paragraphs.length; i += 1) {
    const p = paragraphs[i];
    const text = inlineToPlainText(p.inline).trim();
    if (!text) continue;
    if (isAssessmentStructuralLine(text)) break;
    out.push(p);
  }
  return out;
}

// A per-kind STRUCTURAL line in an sbAssessment card's visible prose (mirrors
// sbAssessmentToDocxParagraphs) — used only to recognize where a free-text
// question paragraph would NOT be (so it's never mistaken for one).
function isAssessmentStructuralLine(text) {
  return (
    /^[●○]\s/.test(text) || // mcq/gmcq/checklist option
    /^•\s/.test(text) || // matching pair / textInput accepted answer
    /^\d+\.\s/.test(text) || // reorder item
    /^(Correct|Incorrect|Incorrect — not final|Partly correct — final|Partly correct — not final):/i.test(text)
  );
}

// Re-derive the handful of plain free-text fields a user can meaningfully
// edit in Word — title/description/instruction for a component card,
// title/question for an assessment card — from the card's VISIBLE, possibly-
// edited prose (`visibleItems`, captured by docxNormalizer.js instead of
// being discarded). Everything else (options, correct-answer flags,
// per-option feedback, whole-question feedback, asset refs) still comes from
// the hidden marker's frozen `props`: those aren't reliably recoverable from
// prose alone, and guessing wrong there is worse than leaving them as
// exported (see the scoping discussion that led to this function — ADAPT-
// 3760 reimport staleness fix, "common text fields only").
//
// Conservative throughout: any paragraph shape that doesn't clearly match
// what the exporter is known to produce leaves the corresponding field
// untouched rather than guessing. Never mutates `props`.
function reconcileCardProps(blockType, props, visibleItems) {
  if (!Array.isArray(visibleItems) || !visibleItems.length) return props;
  const paragraphs = visibleItems.filter((it) => it && it.kind === 'paragraph');
  if (!paragraphs.length) return props;

  const originalTitle = String(props.title || '').trim();
  const headerText = inlineToPlainText(paragraphs[0].inline).trim();
  if (!headerText) return props;

  if (blockType === 'sbComponent') {
    const kind = props.kind || 'text';
    const label = RECONCILE_COMPONENT_LABEL[kind] || kind;
    const prefix = `${label} — `;
    let nextTitle = originalTitle;
    if (headerText.indexOf(prefix) === 0) nextTitle = headerText.slice(prefix.length).trim();
    else if (headerText === label) nextTitle = '';
    else if (!originalTitle) return props; // unexpected shape — don't guess

    let data;
    try {
      data = JSON.parse(props.data || '{}');
    } catch (e) {
      return props;
    }

    // Description: paragraphs immediately after the header, up to the first
    // one recognized as this kind's structural content (media-URL label,
    // image/poster alt caption, Laerdal Form field bullet, or the trailing
    // "Instruction:"/"Transcript:" block) via isComponentStructuralLine's
    // literal-label check — NOT by formatting, so an author's own bold/
    // italic/linked text within the description survives reimport instead
    // of being mistaken for a structural boundary and discarded. Grouped
    // Content is the one kind whose item titles have no literal label
    // (documentConvert.js writes them as a bare bold paragraph), so it alone
    // still uses "fully bold" as its boundary signal.
    const altText = String((data.image && data.image.alt) || (data.media && data.media.poster && data.media.poster.alt) || '').trim();
    const descParagraphs = [];
    for (let i = 1; i < paragraphs.length; i += 1) {
      const p = paragraphs[i];
      const text = inlineToPlainText(p.inline).trim();
      if (!text) continue;
      if (isComponentStructuralLine(text, altText)) break;
      if (kind === 'groupedContent' && isEntirelyBold(p.inline)) break;
      descParagraphs.push(p);
    }

    // Instruction: everything after a literal, bold-only "Instruction:"
    // label paragraph (mirrors the "Transcript:" label convention — see
    // sbComponentToDocxParagraphs). An unambiguous marker, unlike an earlier
    // version of this code that inferred the instruction block from "the
    // trailing run of fully-italic paragraphs" — that forced EVERY
    // instruction run italic at export time to make it detectable, which
    // then made an author's OWN <em> formatting indistinguishable from the
    // convention (OOXML runs can't represent "italic for two different
    // reasons") and required special-casing an image's alt-text caption to
    // avoid misreading it as instruction content. A literal label has
    // neither problem.
    const instrLabelIndex = paragraphs.findIndex((p) => isEntirelyBold(p.inline) && inlineToPlainText(p.inline).trim() === 'Instruction:');
    const instrParagraphs = instrLabelIndex === -1 ? [] : paragraphs.slice(instrLabelIndex + 1);

    // Assign unconditionally (not just when non-empty) — both regions were
    // positively recognized by the scans above (the description loop always
    // runs; the instruction label is either found or, per
    // sbComponentToDocxParagraphs, was never written because there was
    // nothing to label), so an author deleting all the visible text in
    // either region is a real edit to round-trip, not an unrecognized shape
    // to leave alone. Only assigning when non-empty (an earlier version of
    // this code) meant a deletion silently kept the frozen marker's old
    // value forever.
    const nextData = { ...data };
    nextData.description = descParagraphs.length ? paragraphsToHtml(descParagraphs) : '';
    nextData.instruction = instrParagraphs.length ? paragraphsToHtml(instrParagraphs) : '';

    return { ...props, title: nextTitle, data: JSON.stringify(nextData) };
  }

  if (blockType === 'sbAssessment') {
    const kind = props.kind || 'mcq';
    const label = RECONCILE_ASSESSMENT_LABEL[kind] || 'Question';
    const prefix = `${label} — `;
    let headerValue = null;
    if (headerText.indexOf(prefix) === 0) headerValue = headerText.slice(prefix.length).trim();
    else if (headerText === label) headerValue = '';
    if (headerValue === null) return props; // unexpected shape — don't guess

    let data;
    try {
      data = JSON.parse(props.data || '{}');
    } catch (e) {
      return props;
    }
    const nextData = { ...data };

    // Mirrors the exporter's own header precedence (sbAssessmentToDocxParagraphs:
    // `headerText = title || question`): a non-empty original title means the
    // header IS the title, with `question` (if shown) as its own paragraph
    // right after; an empty original title means the header IS the question.
    if (!originalTitle) {
      // `headerValue` is itself a collapsed, single-line, PLAIN-TEXT echo of
      // `question` — sbAssessmentToDocxParagraphs always writes the header
      // as plain text, then additionally writes the full rich `question` as
      // its own paragraph(s) below whenever it isn't already fully captured
      // by that collapsed line (multi-paragraph or any formatting). Prefer
      // reconstructing those richer paragraphs when present, so bold/
      // italic/paragraph breaks survive; only fall back to the plain header
      // when there's nothing more (a simple single-line, unformatted
      // question, where the header already IS the full content).
      const questionParagraphs = collectAssessmentQuestionParagraphs(paragraphs, 1);
      nextData.question = questionParagraphs.length ? paragraphsToHtml(questionParagraphs) : headerValue;
      return { ...props, data: JSON.stringify(nextData) };
    }
    // Assign unconditionally, same reasoning as the sbComponent
    // description/instruction fix above — an author deleting the whole
    // question paragraph (keeping only the title) is a real edit to
    // round-trip, not an unrecognized shape to leave alone.
    const questionParagraphs = collectAssessmentQuestionParagraphs(paragraphs, 1);
    nextData.question = questionParagraphs.length ? paragraphsToHtml(questionParagraphs) : '';
    return { ...props, title: headerValue, data: JSON.stringify(nextData) };
  }

  return props;
}

// Looks for a Q+options run starting at blocks[startIndex]. Returns null if
// there's no question there, or fewer than 2 options, or no option is marked
// correct (bold) — any of those means this isn't confidently a quiz and the
// paragraphs are left alone as plain text instead of guessing.
function detectMcqAt(blocks, startIndex) {
  const questionBlock = blocks[startIndex];
  if (!questionBlock || questionBlock.kind !== 'paragraph') return null;
  const questionInline = stripLeadingPrefix(questionBlock.inline, QUESTION_PREFIX);
  if (questionInline === null || !hasVisibleText(questionInline)) return null;

  const options = [];
  let i = startIndex + 1;
  while (i < blocks.length) {
    const block = blocks[i];
    if (!block || block.kind !== 'paragraph') break;
    const optionInline = stripLeadingPrefix(block.inline, OPTION_PREFIX);
    if (optionInline === null || !hasVisibleText(optionInline)) break;
    options.push({ text: inlineToPlainText(optionInline).trim(), correct: isEntirelyBold(optionInline) });
    i += 1;
  }
  if (options.length < 2 || !options.some((o) => o.correct)) return null;
  return { questionText: inlineToPlainText(questionInline).trim(), options, nextIndex: i };
}

// Second, independently-tried MCQ pattern: a real Word NUMBERED LIST where
// item 1 is the question and the following items are the options (the
// correct one bold) — no "Q:"/"A)" text prefixes at all. Confirmed against a
// real authored quiz doc, which also interleaves a "Correct!"/"Incorrect..."
// feedback paragraph between options, and can break the list's own numbering
// on the last option (rendering it as a plain "D. Titanium"-style paragraph
// instead of a genuine list item) — both handled here.
const FEEDBACK_PREFIX = /^\s*(correct|incorrect)\b/i;

function detectMcqFromNumberedListAt(blocks, startIndex) {
  const questionBlock = blocks[startIndex];
  if (!questionBlock || questionBlock.kind !== 'numberedListItem' || !hasVisibleText(questionBlock.inline)) return null;
  const questionText = inlineToPlainText(questionBlock.inline).trim();
  // Require a real question mark — otherwise this is just an ordinary
  // numbered list/procedure step, not confidently a quiz.
  if (!questionText.endsWith('?')) return null;

  const options = [];
  let i = startIndex + 1;
  while (i < blocks.length) {
    const block = blocks[i];
    if (block && block.kind === 'numberedListItem' && hasVisibleText(block.inline)) {
      options.push({ text: inlineToPlainText(block.inline).trim(), correct: isEntirelyBold(block.inline) });
      i += 1;
      continue;
    }
    if (block && block.kind === 'paragraph') {
      // A lettered option that fell out of the list's own numbering.
      const asOption = options.length > 0 ? stripLeadingPrefix(block.inline, OPTION_PREFIX) : null;
      if (asOption !== null && hasVisibleText(asOption)) {
        options.push({ text: inlineToPlainText(asOption).trim(), correct: isEntirelyBold(asOption) });
        i += 1;
        continue;
      }
      // Feedback prose for the option just collected — kept on it, never
      // treated as a new option/question itself.
      const text = inlineToPlainText(block.inline).trim();
      if (options.length > 0 && FEEDBACK_PREFIX.test(text)) {
        const last = options[options.length - 1];
        last.feedback = last.feedback ? `${last.feedback} ${text}` : text;
        i += 1;
        continue;
      }
    }
    break;
  }
  if (options.length < 2 || !options.some((o) => o.correct)) return null;
  return { questionText, options, nextIndex: i };
}

function makeSbComponent(kind, data, title) {
  return {
    id: nextId('c'),
    type: 'sbComponent',
    props: {
      kind,
      title: title || '',
      adaptComponent: kind,
      data: JSON.stringify({ showTitle: false, description: '', instruction: '', ...data }),
    },
    children: [],
  };
}

/** One NormalizedBlock -> zero-or-more BlockNote blocks (drops truly empty
 *  blocks; a hard line break inside heading/paragraph/quote text splits it
 *  into multiple blocks — see splitInlineOnBreaks). */
function blockToBlockNote(block, warnings) {
  if (!block) return [];
  switch (block.kind) {
    case 'heading': {
      if (!hasVisibleText(block.inline)) return [];
      const level = Math.min(Math.max(1, block.level || 1), MAX_HEADING_LEVEL);
      return splitInlineOnBreaks(block.inline)
        .filter(hasVisibleText)
        .map((line) => ({ id: nextId('h'), type: 'heading', props: { level }, content: inlineToBlockNote(line), children: [] }));
    }
    case 'paragraph': {
      if (!hasVisibleText(block.inline)) return [];
      // A paragraph that's essentially JUST a link to an external video
      // becomes a Video component, not a plain linked line of text.
      const videoRun = (block.inline || []).find((r) => r && r.link && isVideoUrl(r.link));
      if (videoRun) {
        const otherText = (block.inline || [])
          .filter((r) => r !== videoRun)
          .map((r) => (r && r.text) || '')
          .join('')
          .trim();
        if (!otherText) {
          return [
            makeSbComponent('video', {
              media: {
                asset: { link: videoRun.link, url: videoRun.link, external: true },
                transcriptSource: '',
                transcriptText: '',
                captionsSource: '',
                descriptionsSource: '',
                chaptersSource: '',
              },
            }),
          ];
        }
      }
      // Blank interior lines (consecutive <br>s) keep their own empty
      // paragraph block rather than being dropped — an author's deliberate
      // blank-line spacing shouldn't silently disappear on import.
      return splitInlineOnBreaks(block.inline)
        .map((line) => ({ id: nextId('p'), type: 'paragraph', content: inlineToBlockNote(line), children: [] }));
    }
    case 'quote': {
      if (!hasVisibleText(block.inline)) return [];
      // No custom quote block is registered in the storyboard schema — render
      // as a paragraph so the content still imports (structure, not styling).
      return splitInlineOnBreaks(block.inline)
        .map((line) => ({ id: nextId('q'), type: 'paragraph', content: inlineToBlockNote(line), children: [] }));
    }
    // A native BlockNote list block, NOT a Grouped Content card — a real
    // Word/Storyboard list should read as a formatted list within the
    // surrounding Text component, same as a list typed directly into the
    // Storyboard editor (see storyboardGeneration.ts's parseDocToTree, which
    // folds native bulletListItem/numberedListItem blocks into a Text
    // component's <ul>/<ol> body). Nested sub-items are flattened to sibling
    // list items (BlockNote's own nested `children` block tree isn't used
    // elsewhere in this pipeline) rather than dropped.
    case 'bulletListItem':
    case 'numberedListItem': {
      const out = [];
      const pushItem = (b) => {
        if (!hasVisibleText(b.inline)) return;
        out.push({ id: nextId('li'), type: b.kind, content: inlineToBlockNote(b.inline), children: [] });
      };
      const walkChildren = (children) => {
        for (const child of children || []) {
          if (child && (child.kind === 'bulletListItem' || child.kind === 'numberedListItem')) {
            pushItem(child);
            walkChildren(child.children);
          }
        }
      };
      pushItem(block);
      walkChildren(block.children);
      return out;
    }
    case 'table': {
      // BlockNote HAS a native table block (defaultBlockSpecs) — a table
      // should look like an actual grid in the Storyboard editor, not a run
      // of "|"-joined paragraph lines. Adapt itself has no table component,
      // so storyboardGeneration.ts's parseDocToTree folds this into the
      // enclosing Text component's HTML (as a real <table>) at Generate time
      // instead — this block only needs to be a valid, visible BlockNote
      // table here.
      const rows = Array.isArray(block.rows) ? block.rows : [];
      const nonEmptyRows = rows.filter((cells) => Array.isArray(cells) && cells.some((c) => hasVisibleText(c)));
      if (!nonEmptyRows.length) return [];
      return [
        {
          id: nextId('t'),
          type: 'table',
          content: {
            type: 'tableContent',
            rows: nonEmptyRows.map((cells) => ({
              cells: cells.map((cellInline) => inlineToBlockNote(Array.isArray(cellInline) ? cellInline : [])),
            })),
          },
          children: [],
        },
      ];
    }
    case 'image': {
      if (!block.src) return [];
      return [makeSbComponent('image', { image: { link: block.src, alt: block.alt || '' } })];
    }
    case 'richCard': {
      // Reconstructed from a hidden export marker (see docxNormalizer.js) —
      // structure (kind, options, correct-answer flags, feedback, asset
      // refs) comes from the marker's frozen `props` verbatim, since none of
      // that is reliably recoverable from prose. But the marker is a FROZEN
      // copy from export time — if the user edited the VISIBLE title/
      // description/instruction/question text in Word, this reconciles those
      // specific fields back in from what's actually on the page now (see
      // reconcileCardProps) so the edit isn't silently discarded.
      if (!block.blockType || !block.props) return [];
      const props = reconcileCardProps(block.blockType, block.props, block.visibleItems);
      return [{ id: nextId('rc'), type: block.blockType, props, children: [] }];
    }
    case 'unsupported': {
      // Never silently drop content (spec: nothing skipped) — fall back to
      // a plain Text component carrying whatever raw text survived, if any.
      const note = block.note || block.originalTag || 'unknown';
      if (warnings) {
        warnings.push({
          code: 'unsupported-content',
          message: `Unsupported content (${note}) was converted to a Text component as a fallback.`,
          sourceReference: block.sourceReference,
        });
      }
      const text = typeof block.fallbackText === 'string' ? block.fallbackText.trim() : '';
      return text ? [makeSbComponent('text', { description: text })] : [];
    }
    default:
      return [];
  }
}

/**
 * Convert an ordered list of NormalizedBlocks into BlockNote blocks —
 * flattens each block's zero-or-more result (see blockToBlockNote) into one
 * ordered sequence.
 */
function mcqToSbAssessmentBlock(mcq) {
  return {
    id: nextId('qa'),
    type: 'sbAssessment',
    props: {
      kind: 'mcq',
      title: '',
      adaptComponent: 'mcq',
      data: JSON.stringify({
        question: mcq.questionText,
        showTitle: false,
        options: mcq.options.map((o) => ({ text: o.text, correct: o.correct, feedback: o.feedback || '' })),
        feedback: {
          correct: '', incorrect: '', incorrectNotFinal: '', partlyCorrectFinal: '', partlyCorrectNotFinal: '',
        },
      }),
    },
    children: [],
  };
}

function collectBlockNoteSequence(blocks, warnings) {
  const out = [];
  let i = 0;
  while (i < blocks.length) {
    const mcq = detectMcqAt(blocks, i) || detectMcqFromNumberedListAt(blocks, i);
    if (mcq) {
      out.push(mcqToSbAssessmentBlock(mcq));
      if (warnings) {
        warnings.push({
          code: 'detected-mcq',
          message: `Detected a quiz question ("${mcq.questionText.slice(0, 60)}") and converted it to an MCQ assessment — review the options and correct answer.`,
        });
      }
      i = mcq.nextIndex;
      continue;
    }
    out.push(...blockToBlockNote(blocks[i], warnings));
    i += 1;
  }
  return out;
}

// Adapt's course structure requires exactly 4 contiguous levels (Topic >
// Section > Content Group > component) — see storyboardGeneration.ts's
// parseDocToTree. That code silently synthesizes an invisible "New Section"/
// "New Content" node whenever content shows up without its required
// intermediate parent (e.g. a paragraph directly under an H1, or an H3 with
// no preceding H2) — which is exactly what most real-world documents look
// like (they rarely author a full 4-level heading hierarchy). Left alone,
// that produces mystery text the user never typed and can't see or rename
// until AFTER generating the course, and — worse — a heading with truly
// nothing under it still gets emitted, producing an empty Topic/Section that
// breaks the Adapt course build downstream ("does not contain any
// articles").
//
// So this layer does the gap-filling itself, *visibly*: every section is
// numbered by its actual nesting depth (not its literal source heading
// level, which may skip levels), any missing intermediate level gets a real,
// editable placeholder heading inserted before the content that needs it,
// and any section with no real content anywhere in its subtree is dropped
// entirely rather than emitted as an empty container.
const MIN_CONTENT_DEPTH = 3; // paragraphs/lists/tables/images need an open "Content Group"
// Matches parseDocToTree's fallback titles (storyboardGeneration.ts) so the
// same content reads consistently whether viewed in the Storyboard editor
// or, if left unrenamed, in the generated course.
const DEPTH_PLACEHOLDER_TITLE = {
  1: 'New Topic',
  2: 'New Section',
  3: 'New Content',
};

function blockHasContent(block) {
  if (!block) return false;
  if (block.kind === 'heading' || block.kind === 'paragraph' || block.kind === 'quote') return hasVisibleText(block.inline);
  if (block.kind === 'bulletListItem' || block.kind === 'numberedListItem') {
    return hasVisibleText(block.inline) || (block.children || []).some(blockHasContent);
  }
  if (block.kind === 'table') return (block.rows || []).length > 0;
  if (block.kind === 'image') return !!block.src;
  if (block.kind === 'richCard') return !!block.blockType && !!block.props;
  if (block.kind === 'unsupported') return typeof block.fallbackText === 'string' && !!block.fallbackText.trim();
  return false;
}

function sectionHasContent(section) {
  if (!section) return false;
  if ((section.blocks || []).some(blockHasContent)) return true;
  return (section.children || []).some(sectionHasContent);
}

function pushFillerHeadings(out, fromDepth, toDepth, warnings) {
  for (let d = fromDepth + 1; d <= toDepth; d += 1) {
    out.push({
      id: nextId('h'),
      type: 'heading',
      props: { level: Math.min(d, MAX_HEADING_LEVEL) },
      content: inlineToBlockNote([{ text: DEPTH_PLACEHOLDER_TITLE[d] || 'New Content' }]),
      children: [],
    });
  }
  if (toDepth > fromDepth && warnings) {
    warnings.push({
      code: 'synthesized-heading',
      message: 'Added a placeholder heading so this content fits the Storyboard\'s Topic/Section/Content Group structure — rename or remove it as needed.',
    });
  }
}

/**
 * Flatten a NormalizedSection tree into a flat, ordered BlockNote block
 * array. `depth` is the section's position in the ADAPT hierarchy (1 =
 * Topic, 2 = Section, 3 = Content Group, 4+ = component heading) — derived
 * from actual tree nesting, not the section's raw source heading level.
 */
function sectionToBlockNote(section, out, warnings, depth) {
  if (!section || !sectionHasContent(section)) return; // never emit an empty container
  const level = Math.min(depth, MAX_HEADING_LEVEL);
  if (section.title && section.title.trim()) {
    out.push({
      id: nextId('h'),
      type: 'heading',
      props: { level },
      content: inlineToBlockNote([{ text: section.title }]),
      children: [],
    });
  }
  const ownBlocks = (section.blocks || []).filter(blockHasContent);
  if (ownBlocks.length && level < MIN_CONTENT_DEPTH) {
    pushFillerHeadings(out, level, MIN_CONTENT_DEPTH, warnings);
  }
  for (const bn of collectBlockNoteSequence(ownBlocks, warnings)) out.push(bn);
  for (const child of section.children || []) {
    sectionToBlockNote(child, out, warnings, depth + 1);
  }
}

/**
 * NormalizedDocument -> flat array of valid BlockNote blocks.
 * Mutates `normalizedDocument.metadata.warnings` with any conversion-time
 * warnings collected while flattening (e.g. nested-list / unsupported-content).
 */
function normalizedDocumentToBlockNote(normalizedDocument) {
  const out = [];
  const warnings = [];
  for (const section of (normalizedDocument && normalizedDocument.sections) || []) {
    sectionToBlockNote(section, out, warnings, 1);
  }
  if (!out.length) {
    // Never hand back an empty document — a single empty paragraph is a
    // valid, harmless BlockNote document (mirrors the editor's own
    // STARTER_DOCUMENT), rather than surfacing this as a hard failure.
    out.push({ id: nextId('p'), type: 'paragraph', content: [], children: [] });
  }
  if (warnings.length && normalizedDocument && normalizedDocument.metadata) {
    normalizedDocument.metadata.warnings = [...(normalizedDocument.metadata.warnings || []), ...warnings];
  }
  return out;
}

module.exports = { normalizedDocumentToBlockNote, inlineToBlockNote };
