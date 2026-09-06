// DOCX -> NormalizedDocument (ADAPT-3760 storyboard import).
//
// Pipeline: Mammoth (docx -> HTML, with embedded images inlined as data URIs)
// -> sanitize (htmlSanitizer) -> walk the sanitized DOM (htmlparser2 +
// domhandler) into a flat, ordered list of content items -> group items into
// a NormalizedSection tree by heading level, auto-opening an editable
// "Introduction" section for any content that precedes the first heading.
//
// Kept independent of BlockNote — see toBlockNote.js for the next stage.

const { randomUUID } = require('crypto');
const mammoth = require('mammoth');
const { Parser } = require('htmlparser2');
const { DomHandler } = require('domhandler');
const domutils = require('domutils');

const { sanitizeMammothHtml } = require('./htmlSanitizer');
const { readDocxMetadata } = require('./reimportMetadata');

const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const INLINE_MARK_TAGS = { strong: 'bold', b: 'bold', em: 'italic', i: 'italic', u: 'underline', s: 'strike', strike: 'strike' };

// Hidden per-card markers written by documentConvert.js's blocksToDocx (see
// CARD_MARKER_BEGIN/END there) — bracket a rich card's human-readable prose
// so it can be recognized and swapped back for the original block verbatim
// on import, instead of re-derived (lossily) from that prose.
const CARD_MARKER_BEGIN = 'SB_CARD_BEGIN::';
const CARD_MARKER_END = 'SB_CARD_END';

/** Parse an HTML string into a domhandler DOM tree (synchronous — htmlparser2 buffers nothing async for a single write+end). */
function parseHtml(html) {
  let dom = [];
  const handler = new DomHandler((err, result) => {
    if (!err) dom = result;
  });
  const parser = new Parser(handler, { decodeEntities: true });
  parser.write(html);
  parser.end();
  return dom;
}

function isElement(node) {
  return node && node.type === 'tag';
}
function isText(node) {
  return node && node.type === 'text';
}

/** Walk inline content (text + strong/em/u/s/a), returning NormalizedInlineRun[]. */
function extractInline(node, styles) {
  const runs = [];
  const walk = (n, currentStyles) => {
    if (isText(n)) {
      if (n.data) runs.push({ text: n.data, ...currentStyles });
      return;
    }
    if (!isElement(n)) return;
    const tag = n.name;
    if (tag === 'br') {
      runs.push({ text: '\n', ...currentStyles });
      return;
    }
    let nextStyles = currentStyles;
    if (INLINE_MARK_TAGS[tag]) {
      nextStyles = { ...currentStyles, [INLINE_MARK_TAGS[tag]]: true };
    } else if (tag === 'a') {
      nextStyles = { ...currentStyles, link: n.attribs && n.attribs.href };
    } else if (tag === 'img') {
      // Images are handled at the block level (extractItemsFromParagraph),
      // never inline — skip if one slips through here.
      return;
    }
    for (const child of domutils.getChildren(n) || []) walk(child, nextStyles);
  };
  walk(node, styles || {});
  // Collapse whitespace-only runs from Mammoth's own indentation, but keep
  // deliberate single spaces between adjacent inline elements.
  return runs.filter((r) => r.text !== '');
}

function textOf(node) {
  return extractInline(node).map((r) => r.text).join('').trim();
}

/** A <p> may contain an inline <img> (Mammoth's own image markup shape) — split into text/image items in order. */
function itemsFromParagraph(p) {
  const items = [];
  let currentRuns = [];
  const flush = () => {
    if (currentRuns.length) {
      items.push({ kind: 'paragraph', inline: currentRuns });
      currentRuns = [];
    }
  };
  const walk = (n, styles) => {
    if (isText(n)) {
      if (n.data) currentRuns.push({ text: n.data, ...styles });
      return;
    }
    if (!isElement(n)) return;
    if (n.name === 'img') {
      flush();
      const src = (n.attribs && n.attribs.src) || '';
      const alt = (n.attribs && n.attribs.alt) || '';
      if (src) items.push({ kind: 'image', src, alt });
      return;
    }
    if (n.name === 'br') {
      currentRuns.push({ text: '\n', ...styles });
      return;
    }
    let nextStyles = styles;
    if (INLINE_MARK_TAGS[n.name]) nextStyles = { ...styles, [INLINE_MARK_TAGS[n.name]]: true };
    else if (n.name === 'a') nextStyles = { ...styles, link: n.attribs && n.attribs.href };
    for (const child of domutils.getChildren(n) || []) walk(child, nextStyles);
  };
  for (const child of domutils.getChildren(p) || []) walk(child, {});
  flush();
  return items;
}

/** Recursively walk a <ul>/<ol>, producing one NormalizedBlock per <li> (nested sub-lists become `.children`). */
function extractList(listEl, ordered) {
  const out = [];
  for (const li of domutils.getChildren(listEl) || []) {
    if (!isElement(li) || li.name !== 'li') continue;
    const ownInline = [];
    const nestedChildren = [];
    const walkLi = (n, styles) => {
      if (isText(n)) {
        if (n.data) ownInline.push({ text: n.data, ...styles });
        return;
      }
      if (!isElement(n)) return;
      if (n.name === 'ul' || n.name === 'ol') {
        nestedChildren.push(...extractList(n, n.name === 'ol'));
        return;
      }
      if (n.name === 'img') return; // images inside list items aren't supported in v1
      let nextStyles = styles;
      if (INLINE_MARK_TAGS[n.name]) nextStyles = { ...styles, [INLINE_MARK_TAGS[n.name]]: true };
      else if (n.name === 'a') nextStyles = { ...styles, link: n.attribs && n.attribs.href };
      for (const child of domutils.getChildren(n) || []) walkLi(child, nextStyles);
    };
    for (const child of domutils.getChildren(li) || []) walkLi(child, {});
    out.push({
      kind: ordered ? 'numberedListItem' : 'bulletListItem',
      inline: ownInline.filter((r) => r.text !== ''),
      children: nestedChildren,
    });
  }
  return out;
}

function extractTable(tableEl) {
  const rows = [];
  const rowEls = domutils.findAll((n) => isElement(n) && n.name === 'tr', domutils.getChildren(tableEl) || []);
  for (const tr of rowEls) {
    const cellEls = (domutils.getChildren(tr) || []).filter((n) => isElement(n) && (n.name === 'td' || n.name === 'th'));
    rows.push(cellEls.map((cell) => extractInline(cell)));
  }
  return rows;
}

/** Sanitized top-level DOM nodes -> a flat, ordered list of NormalizedBlock-ish
 * items (headings kept separate for sectioning), plus any document title
 * found via Word's "Title" paragraph style (remapped to a recognizable class
 * by the mammoth styleMap below — see parseDocxToNormalizedDocument). */
function extractItems(dom) {
  const items = [];
  let docTitleFromStyle;
  let swallowing = false; // inside a rich-card marker region — see CARD_MARKER_BEGIN/END
  for (const node of dom) {
    if (isElement(node) && node.name === 'p') {
      const text = textOf(node);
      if (swallowing) {
        if (text === CARD_MARKER_END) swallowing = false;
        continue; // everything between BEGIN/END is this card's own prose rendering — discard it
      }
      if (text.indexOf(CARD_MARKER_BEGIN) === 0) {
        try {
          const parsed = JSON.parse(text.slice(CARD_MARKER_BEGIN.length));
          if (parsed && parsed.type && parsed.props) {
            items.push({ kind: 'richCard', blockType: parsed.type, props: parsed.props });
          }
        } catch (e) {
          /* malformed marker — fall through to normal parsing of whatever follows */
        }
        swallowing = true;
        continue;
      }
    } else if (swallowing) {
      // Safety valve: if the END marker was somehow lost/stripped, don't let
      // a lost marker silently eat the rest of the document — a heading is
      // never part of a card's own rendering, so treat it as an implicit
      // end-of-swallow and process it normally rather than skipping it.
      if (isElement(node) && HEADING_TAGS.has(node.name)) {
        swallowing = false;
      } else {
        continue;
      }
    }
    if (isText(node)) {
      const t = (node.data || '').trim();
      if (t) items.push({ kind: 'paragraph', inline: [{ text: t }] });
      continue;
    }
    if (!isElement(node)) continue;
    const tag = node.name;
    if (HEADING_TAGS.has(tag)) {
      const level = parseInt(tag[1], 10);
      const inline = extractInline(node);
      if (inline.some((r) => r.text.trim())) items.push({ kind: 'heading', level, inline });
      continue;
    }
    if (tag === 'p') {
      // A Word "Title"-styled paragraph (e.g. the course title, written by
      // blocksToDocx's own export) is the document title, not body content
      // — Mammoth's default style mapping otherwise turns it into a plain,
      // unrecognized <p>, which used to land as stray text before the first
      // real heading and drag the whole "Introduction" auto-section +
      // hierarchy-gap-filling machinery in behind it for no reason.
      if (node.attribs && node.attribs.class === 'sb-doc-title') {
        const text = textOf(node);
        if (text) docTitleFromStyle = text;
        continue;
      }
      items.push(...itemsFromParagraph(node));
      continue;
    }
    if (tag === 'ul' || tag === 'ol') {
      const listItems = extractList(node, tag === 'ol');
      for (const li of listItems) items.push(li);
      continue;
    }
    if (tag === 'table') {
      const rows = extractTable(node);
      if (rows.length) items.push({ kind: 'table', rows });
      continue;
    }
    if (tag === 'img') {
      const src = (node.attribs && node.attribs.src) || '';
      if (src) items.push({ kind: 'image', src, alt: (node.attribs && node.attribs.alt) || '' });
    }
    // Anything else has already been stripped by the sanitizer whitelist.
  }
  return { items, docTitleFromStyle };
}

function newSection(level, title) {
  return { id: randomUUID(), level, title: title || '', blocks: [], children: [] };
}

/** Group the flat item list into a NormalizedSection tree keyed on heading level. */
function groupIntoSections(items) {
  const root = [];
  // stack[i] = the currently-open section at heading level i+1
  const stack = [];
  let introSection = null;

  const currentParentBlocks = () => {
    if (!stack.length) {
      if (!introSection) {
        introSection = newSection(1, 'Introduction');
        root.push(introSection);
      }
      return introSection.blocks;
    }
    return stack[stack.length - 1].blocks;
  };

  for (const item of items) {
    if (item.kind === 'heading') {
      const section = newSection(item.level, item.inline.map((r) => r.text).join(''));
      // pop any open sections at this level or deeper
      while (stack.length && stack[stack.length - 1].level >= item.level) stack.pop();
      if (stack.length) {
        stack[stack.length - 1].children.push(section);
      } else {
        root.push(section);
      }
      stack.push(section);
      continue;
    }
    currentParentBlocks().push(item);
  }
  return root;
}

/**
 * @param {Buffer} buffer
 * @param {{ sourceFileName?: string }} [meta]
 * @returns {Promise<import('./types').NormalizedDocument>}
 */
async function parseDocxToNormalizedDocument(buffer, meta) {
  const sourceFileName = (meta && meta.sourceFileName) || 'document.docx';
  const { value: html, messages } = await mammoth.convertToHtml(
    { buffer },
    {
      convertImage: mammoth.images.dataUri,
      // Word's "Title" style (used by blocksToDocx for the course title) is
      // otherwise indistinguishable from a plain paragraph on the way back
      // in — remap it to a recognizable class so extractItems can treat it
      // as the document title instead of stray body content.
      styleMap: ['p.Title => p.sb-doc-title:fresh'],
    },
  );

  const warnings = (messages || [])
    .filter((m) => m && m.type !== 'error') // errors already reject the whole conversion above
    .map((m) => ({ code: `mammoth-${m.type || 'warning'}`, message: m.message }));

  const sanitized = sanitizeMammothHtml(html);
  const dom = parseHtml(sanitized);
  const { items, docTitleFromStyle } = extractItems(dom);
  const sections = groupIntoSections(items);

  const firstHeading = items.find((i) => i.kind === 'heading');
  const detectedTitle =
    docTitleFromStyle ||
    (firstHeading ? firstHeading.inline.map((r) => r.text).join('') : sourceFileName.replace(/\.[^.]+$/, ''));

  const reimport = readDocxMetadata(buffer);

  return {
    metadata: {
      sourceFileName,
      sourceFileType: 'docx',
      importedAt: new Date().toISOString(),
      fidelity: 'high',
      warnings,
      documentTitle: detectedTitle,
      ...(reimport
        ? {
            courseId: reimport.courseId,
            storyboardId: reimport.storyboardId,
            exportSchemaVersion: String(reimport.schemaVersion),
          }
        : {}),
    },
    sections,
  };
}

module.exports = { parseDocxToNormalizedDocument, extractInline, extractItems, groupIntoSections };
