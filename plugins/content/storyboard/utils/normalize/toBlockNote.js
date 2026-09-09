// NormalizedDocument -> BlockNote blocks (ADAPT-3760 storyboard import).
//
// Kept independent of any parser: takes only the plain NormalizedDocument
// JSON shape (see docxNormalizer.js / pdfNormalizer.js / pptxNormalizer.js)
// and returns valid BlockNote block JSON matching the storyboard editor's
// registered schema.
//
// Only `heading` and `paragraph` become native BlockNote blocks — both are
// properly understood by storyboardGeneration.ts's parseDocToTree already.
// Everything else (lists, tables, images) is emitted as an `sbComponent`
// card instead: parseDocToTree has NO case for native `bulletListItem`/
// `numberedListItem`/`table` block types at all (they're silently dropped
// during Save/Generate), and a native `image` block generates with no actual
// image reference wired up (only `sbComponent(kind:'image')` cards carry
// that through). Using the same component kinds resolveAdaptComponent
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
    if (run.link) {
      out.push({ type: 'link', href: run.link, content: [{ type: 'text', text: run.text, styles: node.styles }] });
      continue;
    }
    out.push(node);
  }
  return out;
}

function hasVisibleText(inline) {
  return Array.isArray(inline) && inline.some((r) => r && r.text && r.text.trim());
}

function inlineToPlainText(inline) {
  return Array.isArray(inline) ? inline.map((r) => (r && r.text) || '').join('') : '';
}

/** A list item's own text, with any nested sub-items flattened into it as
 * indented continuation lines — groupedContent components have no concept
 * of nested items, so this is the best-effort "preserve nesting" fallback. */
function flattenListItemText(block) {
  const lines = [inlineToPlainText(block.inline).trim()];
  for (const child of block.children || []) {
    if (child && (child.kind === 'bulletListItem' || child.kind === 'numberedListItem')) {
      const nested = flattenListItemText(child);
      if (nested) lines.push(`  - ${nested}`);
    }
  }
  return lines.filter(Boolean).join('\n');
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

/** A run of consecutive list-item blocks -> one groupedContent sbComponent. */
function listRunToSbComponent(items) {
  const groupItems = items.map((b) => ({ body: flattenListItemText(b) })).filter((it) => it.body);
  if (!groupItems.length) return null;
  return makeSbComponent('groupedContent', { items: groupItems });
}

/** One NormalizedBlock -> zero-or-one BlockNote block (drops truly empty blocks). */
function blockToBlockNote(block, warnings) {
  if (!block) return null;
  switch (block.kind) {
    case 'heading': {
      if (!hasVisibleText(block.inline)) return null;
      const level = Math.min(Math.max(1, block.level || 1), MAX_HEADING_LEVEL);
      return { id: nextId('h'), type: 'heading', props: { level }, content: inlineToBlockNote(block.inline), children: [] };
    }
    case 'paragraph': {
      if (!hasVisibleText(block.inline)) return null;
      return { id: nextId('p'), type: 'paragraph', content: inlineToBlockNote(block.inline), children: [] };
    }
    case 'quote': {
      if (!hasVisibleText(block.inline)) return null;
      // No custom quote block is registered in the storyboard schema — render
      // as a paragraph so the content still imports (structure, not styling).
      return { id: nextId('q'), type: 'paragraph', content: inlineToBlockNote(block.inline), children: [] };
    }
    // Lists are handled at the sequence level (see collectBlockNoteSequence)
    // so a run of items becomes ONE groupedContent card, not one per item —
    // reaching blockToBlockNote directly for a single item is a fallback.
    case 'bulletListItem':
    case 'numberedListItem':
      return listRunToSbComponent([block]);
    case 'table': {
      const rows = Array.isArray(block.rows) ? block.rows : [];
      if (!rows.length) return null;
      const items = rows
        .map((cells) => {
          const texts = cells.map((cell) => inlineToPlainText(cell).trim());
          return { title: texts[0] || '', body: texts.slice(1).join(' | ') };
        })
        .filter((it) => it.title || it.body);
      if (!items.length) return null;
      // Adapt has no native table component — best-effort: one groupedContent
      // item per row (first cell as title, remaining cells joined as body).
      return makeSbComponent('groupedContent', { items });
    }
    case 'image': {
      if (!block.src) return null;
      return makeSbComponent('image', { image: { link: block.src, alt: block.alt || '' } });
    }
    case 'richCard': {
      // Reconstructed verbatim from a hidden export marker (see
      // docxNormalizer.js) — the exact original sbComponent/sbAssessment
      // block, not re-derived from lossy prose.
      if (!block.blockType || !block.props) return null;
      return { id: nextId('rc'), type: block.blockType, props: block.props, children: [] };
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
      return text ? makeSbComponent('text', { description: text }) : null;
    }
    default:
      return null;
  }
}

/**
 * Convert an ordered list of NormalizedBlocks into BlockNote blocks, merging
 * consecutive list-item runs into a single groupedContent card each (rather
 * than converting them one at a time).
 */
function collectBlockNoteSequence(blocks, warnings) {
  const out = [];
  let run = [];
  const flushRun = () => {
    if (!run.length) return;
    const bn = listRunToSbComponent(run);
    if (bn) out.push(bn);
    run = [];
  };
  for (const block of blocks) {
    if (block.kind === 'bulletListItem' || block.kind === 'numberedListItem') {
      run.push(block);
      continue;
    }
    flushRun();
    const bn = blockToBlockNote(block, warnings);
    if (bn) out.push(bn);
  }
  flushRun();
  return out;
}

// Adapt's course structure requires exactly 4 contiguous levels (Topic >
// Section > Content Group > component) — see storyboardGeneration.ts's
// parseDocToTree. That code silently synthesizes an invisible "Untitled
// Section"/"Untitled Content Group" node whenever content shows up without
// its required intermediate parent (e.g. a paragraph directly under an H1,
// or an H3 with no preceding H2) — which is exactly what most real-world
// documents look like (they rarely author a full 4-level heading hierarchy).
// Left alone, that produces mystery text the user never typed and can't see
// or rename until AFTER generating the course, and — worse — a heading with
// truly nothing under it still gets emitted, producing an empty Topic/
// Section that breaks the Adapt course build downstream ("does not contain
// any articles").
//
// So this layer does the gap-filling itself, *visibly*: every section is
// numbered by its actual nesting depth (not its literal source heading
// level, which may skip levels), any missing intermediate level gets a real,
// editable placeholder heading inserted before the content that needs it,
// and any section with no real content anywhere in its subtree is dropped
// entirely rather than emitted as an empty container.
const MIN_CONTENT_DEPTH = 3; // paragraphs/lists/tables/images need an open "Content Group"
const DEPTH_PLACEHOLDER_TITLE = { 1: 'Untitled Topic', 2: 'Untitled Section', 3: 'Untitled Content Group' };

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
      content: inlineToBlockNote([{ text: DEPTH_PLACEHOLDER_TITLE[d] || 'Untitled' }]),
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
