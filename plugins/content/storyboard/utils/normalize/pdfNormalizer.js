// PDF -> NormalizedDocument (ADAPT-3842 storyboard PDF import).
//
// PDFs carry no structural markup at all (no real headings/lists/tables in
// the format itself) — this reconstructs approximate structure purely from
// layout: font-size-relative-to-body for heading levels, leading bullet/
// number characters for lists, paintImageXObject/paintInlineImageXObject +
// the accumulated CTM for image placement, and column-position clustering
// (detectTables/tableRegionToRows) for best-effort inference of borderless
// ("stream") tables — rows/columns are guessed from text alignment, not read
// from any real table structure, since PDF has none. Bold/italic come from
// pdf.js's own font descriptor (page.commonObjs), not string guessing.
// Reuses docxNormalizer's groupIntoSections so PDF items only need to match
// its NormalizedItem shape ({kind, inline, ...}) — see that file for the
// shape reference.
//
// Fidelity is inherently lower than DOCX (see metadata.fidelity below): no
// reimport round-trip metadata, and headings/paragraphs/lists/tables are all
// approximate reconstructions from position/font-size heuristics rather than
// real markup.

const { groupIntoSections } = require('./docxNormalizer');

// Lines whose baselines fall within this many points of each other are
// treated as the same visual line (handles sub-pixel baseline jitter between
// runs on one line).
const LINE_Y_TOLERANCE = 2;
const BULLET_PATTERN = /^[•●○◦‣▪·*-]\s+/;
// Letter markers only match "A)" / "B)" style (common MCQ options), not
// "A." — the latter collides with sentence-initial abbreviations/initials.
const NUMBERED_PATTERN = /^(?:\d{1,3}[.)]|[a-zA-Z]\))\s+/;

/** Merge adjacent same-styled runs on one line into NormalizedInlineRun[], stripping a leading marker (bullet/number prefix) if given. */
function lineToInlineRuns(line, stripLen = 0) {
  const merged = [];
  let skip = stripLen;
  for (const run of line.runs) {
    let text = run.text;
    if (skip > 0) {
      if (skip >= text.length) {
        skip -= text.length;
        continue;
      }
      text = text.slice(skip);
      skip = 0;
    }
    if (!text) continue;
    const last = merged[merged.length - 1];
    if (last && !!last.bold === !!run.bold && !!last.italic === !!run.italic) {
      last.text += text;
    } else {
      const styled = { text };
      if (run.bold) styled.bold = true;
      if (run.italic) styled.italic = true;
      merged.push(styled);
    }
  }
  return merged;
}

/** The most common rounded font size across the document, weighted by character count — treated as "body text" for relative heading-size classification. */
function computeBodySize(allLines) {
  const weight = new Map();
  for (const line of allLines) {
    for (const run of line.runs) {
      const size = Math.round(run.size);
      weight.set(size, (weight.get(size) || 0) + run.text.length);
    }
  }
  let mode = 11;
  let best = -1;
  for (const [size, w] of weight) {
    if (w > best) {
      best = w;
      mode = size;
    }
  }
  return mode || 11;
}

function classifyHeadingLevel(size, bodySize) {
  const ratio = size / bodySize;
  if (ratio >= 1.8) return 1;
  if (ratio >= 1.45) return 2;
  if (ratio >= 1.2) return 3;
  return 0;
}

/** Resolve bold/italic for a font name via pdf.js's own parsed font descriptor (page.commonObjs), cached per page. */
function makeFontInfoResolver(page) {
  const cache = new Map();
  return (fontName) => {
    if (cache.has(fontName)) return cache.get(fontName);
    let info = { bold: false, italic: false };
    try {
      const f = page.commonObjs.get(fontName);
      if (f) info = { bold: !!f.bold, italic: !!f.italic };
    } catch (e) {
      // Not resolved (unusual after getOperatorList already ran) — fall back to unstyled.
    }
    cache.set(fontName, info);
    return info;
  };
}

/** Group a page's text items into visual lines, top-to-bottom then left-to-right. */
function buildLines(textContent, fontInfo) {
  const runs = [];
  for (const it of textContent.items) {
    // Keep whitespace-only items (e.g. a lone space between two
    // differently-styled runs from a PDFKit `continued: true` sequence) —
    // dropping them here would silently glue adjacent words together at a
    // style boundary ("with" + "bold text" -> "withbold text").
    if (!it.str) continue;
    const { bold, italic } = fontInfo(it.fontName);
    runs.push({
      text: it.str,
      x: it.transform[4],
      y: it.transform[5],
      size: Math.abs(it.transform[3]) || Math.abs(it.transform[0]) || 10,
      width: typeof it.width === 'number' ? it.width : 0,
      bold,
      italic,
    });
  }
  const sorted = runs.sort((a, b) => b.y - a.y);
  const lines = [];
  for (const run of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - run.y) <= LINE_Y_TOLERANCE) {
      last.runs.push(run);
      last.y = (last.y + run.y) / 2;
    } else {
      lines.push({ y: run.y, runs: [run] });
    }
  }
  for (const line of lines) line.runs.sort((a, b) => a.x - b.x);
  for (const line of lines) line.runs = dedupeOverlappingRuns(line.runs);
  return lines;
}

// Some PDF generators (notably faux-bold rendering, where a renderer paints
// the same glyphs twice at a tiny offset to simulate a bold weight instead of
// using a real bold font) emit the identical string twice at virtually the
// same position. Text-content-wise that reads as the word being duplicated —
// collapse same-text runs that sit on top of each other (position, not just
// text, must match) so genuinely repeated words in real prose are untouched.
function dedupeOverlappingRuns(runs) {
  const out = [];
  for (const run of runs) {
    const last = out[out.length - 1];
    if (last && last.text === run.text && Math.abs(last.x - run.x) < 0.5) continue;
    out.push(run);
  }
  return out;
}

// A blank gap this many times the font size (or more) marks a table column
// boundary rather than ordinary word-spacing. PDFs that lay out a table
// without ruling lines ("stream" tables) place each cell's text at its own
// explicit position, so pdf.js's own getTextContent() inserts a single
// whitespace item spanning the full blank gap between cells — its `width`
// directly reports the gap distance, which is far larger than a normal
// inter-word space (a few points) for any real column layout.
const COLUMN_GAP_RATIO = 2.5;

/** Split one line's runs into column segments wherever a big blank-gap marker occurs (see COLUMN_GAP_RATIO) — the gap markers themselves are dropped, not attached to either segment. */
function splitLineIntoSegments(line) {
  const segments = [];
  let current = [];
  for (const run of line.runs) {
    const isGapMarker = run.text.trim() === '' && run.width > Math.max(run.size, 8) * COLUMN_GAP_RATIO;
    if (isGapMarker) {
      if (current.length) segments.push(current);
      current = [];
      continue;
    }
    current.push(run);
  }
  if (current.length) segments.push(current);
  return segments.map((runs) => ({ x: runs[0].x, runs }));
}

/** 1D-cluster a set of X positions (e.g. every segment's start-X across many lines) into a small set of representative column boundaries. */
function clusterColumnBounds(xs, tolerance = 12) {
  const sorted = xs.slice().sort((a, b) => a - b);
  const clusters = [];
  for (const x of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && x - last.sum / last.count <= tolerance) {
      last.sum += x;
      last.count += 1;
    } else {
      clusters.push({ sum: x, count: 1 });
    }
  }
  return clusters.map((c) => c.sum / c.count);
}

function nearestColumnIndex(x, colBounds, tolerance = 20) {
  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < colBounds.length; i++) {
    const d = Math.abs(x - colBounds[i]);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return bestDist <= tolerance ? best : -1;
}

// Assign a line's runs to columns by walking left-to-right: a run only
// starts a NEW column when its own X snaps tightly to a known boundary
// further right than the column we're currently in — anything else
// (a mid-sentence bold word, an ordinary word deep inside a wrapped cell)
// keeps accumulating into the CURRENT column. Splitting per-run like this
// (rather than trusting each line's own gap-detected segments) is what
// makes this robust even when a wrapped cell's text nearly fills its column
// width, leaving too little blank gap for pdf.js to flag a boundary on that
// specific line — the column positions are already known from the region's
// other, cleanly-gapped lines, so this line doesn't need to rediscover them.
const COLUMN_SNAP_TOLERANCE = 8;

function assignRunsToColumns(line, colBounds) {
  const cols = Array.from({ length: colBounds.length }, () => []);
  let currentCol = -1;
  for (const run of line.runs) {
    if (run.text.trim() === '') continue;
    const snapIdx = nearestColumnIndex(run.x, colBounds, COLUMN_SNAP_TOLERANCE);
    if (snapIdx !== -1 && snapIdx > currentCol) currentCol = snapIdx;
    if (currentCol === -1) continue;
    cols[currentCol].push(run);
  }
  return cols;
}

/** Fold a detected table region's lines into NormalizedTable rows ({rows: Array<cell-inline-runs[]>}), merging a cell's wrapped continuation lines. The "anchor" column (fewest populated lines — typically a short label/number that never wraps) marks where each new row starts; any other column's line without the anchor present is a continuation of the currently-open row's matching cell. */
function tableRegionToRows(regionLines, colBounds) {
  const colCount = colBounds.length;
  const assigned = regionLines.map(({ line }) => assignRunsToColumns(line, colBounds));

  const counts = new Array(colCount).fill(0);
  for (const cols of assigned) {
    for (let c = 0; c < colCount; c++) if (cols[c].length) counts[c] += 1;
  }
  let anchor = 0;
  for (let c = 1; c < colCount; c++) if (counts[c] < counts[anchor]) anchor = c;

  const rows = [];
  let current = null;
  for (const cols of assigned) {
    if (cols[anchor].length && current) {
      rows.push(current);
      current = null;
    }
    if (!current) current = Array.from({ length: colCount }, () => []);
    for (let c = 0; c < colCount; c++) {
      if (cols[c].length) {
        if (current[c].length) current[c].push({ text: ' ' });
        current[c].push(...lineToInlineRuns({ runs: cols[c] }));
      }
    }
  }
  if (current) rows.push(current);
  return rows;
}

/** Scan a page's lines for borderless ("stream") table regions — contiguous runs of column-aligned lines — pulling their lines out of the normal flow and replacing them with reconstructed table rows. Pages with no such region are returned untouched. */
function detectTables(lines) {
  const lineSegs = lines.map((line) => ({ line, segments: splitLineIntoSegments(line) }));
  const multiSegLines = lineSegs.filter((ls) => ls.segments.length >= 2);
  if (!multiSegLines.length) return { plainLines: lines, tables: [] };

  const allStartXs = multiSegLines.flatMap((ls) => ls.segments.map((s) => s.x));
  const colBounds = clusterColumnBounds(allStartXs);
  if (colBounds.length < 2) return { plainLines: lines, tables: [] };

  const belongsToTable = (segments) => segments.length > 0 && segments.every((s) => nearestColumnIndex(s.x, colBounds) !== -1);

  const plainLines = [];
  const tables = [];
  let i = 0;
  while (i < lineSegs.length) {
    const entry = lineSegs[i];
    if (entry.segments.length >= 2 && belongsToTable(entry.segments)) {
      const region = [];
      let j = i;
      while (j < lineSegs.length) {
        const cur = lineSegs[j];
        if (!cur.segments.length || !belongsToTable(cur.segments)) break;
        // A lone segment sitting at the table's leftmost column boundary reads
        // exactly like ordinary paragraph text resuming after the table ends
        // (both are flush with the page's left margin) — genuine wrapped-cell
        // continuations almost always land in a LATER column (the leftmost
        // one is conventionally the short, non-wrapping row label/number), so
        // treat this as the end of the region rather than an extra row.
        if (cur.segments.length === 1 && nearestColumnIndex(cur.segments[0].x, colBounds) === 0) break;
        region.push(cur);
        j += 1;
      }
      // Require at least 2 genuine multi-column lines so a single line that
      // merely has 2 words far apart isn't mistaken for a whole table.
      const multiCount = region.filter((r) => r.segments.length >= 2).length;
      if (multiCount >= 2) {
        tables.push({ y: region[0].line.y, rows: tableRegionToRows(region, colBounds) });
        i = j;
        continue;
      }
    }
    plainLines.push(entry.line);
    i += 1;
  }
  return { plainLines, tables };
}

/** Walk a page's operator list tracking the CTM (via save/restore/transform) to find each painted image's page-space position, for interleaving with text in reading order. */
function extractPageImages(page, opList, pdfjsLib) {
  const { OPS } = pdfjsLib;
  const images = [];
  const stack = [[1, 0, 0, 1, 0, 0]];
  const mul = (m, top) => [
    m[0] * top[0] + m[1] * top[2],
    m[0] * top[1] + m[1] * top[3],
    m[2] * top[0] + m[3] * top[2],
    m[2] * top[1] + m[3] * top[3],
    m[4] * top[0] + m[5] * top[2] + top[4],
    m[4] * top[1] + m[5] * top[3] + top[5],
  ];
  const { fnArray, argsArray } = opList;
  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i];
    if (fn === OPS.save) {
      stack.push(stack[stack.length - 1].slice());
    } else if (fn === OPS.restore) {
      if (stack.length > 1) stack.pop();
    } else if (fn === OPS.transform) {
      const top = stack[stack.length - 1];
      stack[stack.length - 1] = mul(argsArray[i], top);
    } else if (fn === OPS.paintImageXObject || fn === OPS.paintImageXObjectRepeat) {
      // Referenced XObject — args[0] is an id looked up in page.objs (populated
      // as a side effect of the getOperatorList() call the caller already awaited).
      const imgId = argsArray[i][0];
      let data = null;
      try {
        data = page.objs.get(imgId);
      } catch (e) {
        data = null;
      }
      if (data && data.data && data.width && data.height) {
        images.push({ ctm: stack[stack.length - 1].slice(), data });
      }
    } else if (fn === OPS.paintInlineImageXObject) {
      // Inline (BI/ID/EI) image — very common in Word/LibreOffice/Adobe PDF
      // exports for embedded pictures. Unlike a referenced XObject, the pixel
      // data sits directly in args[0] — there is no id to look up.
      const data = argsArray[i][0];
      if (data && data.data && data.width && data.height) {
        images.push({ ctm: stack[stack.length - 1].slice(), data });
      }
    } else if (fn === OPS.paintInlineImageXObjectGroup) {
      // A batch of inline images sharing one operator call — args[0] is an array.
      const list = Array.isArray(argsArray[i][0]) ? argsArray[i][0] : [];
      for (const data of list) {
        if (data && data.data && data.width && data.height) {
          images.push({ ctm: stack[stack.length - 1].slice(), data });
        }
      }
    }
  }
  return images;
}

/** Decode pdf.js's raw pixel buffer (RGB/RGBA/1bpp-grayscale) into a real PNG data URI via sharp. */
async function encodeImageToPng(imgData, pdfjsLib) {
  const sharp = require('sharp');
  const { ImageKind } = pdfjsLib;
  let raw = Buffer.from(imgData.data);
  let channels = 1;
  if (imgData.kind === ImageKind.RGBA_32BPP) {
    channels = 4;
  } else if (imgData.kind === ImageKind.RGB_24BPP) {
    channels = 3;
  } else if (imgData.kind === ImageKind.GRAYSCALE_1BPP) {
    const out = Buffer.alloc(imgData.width * imgData.height);
    const rowBytes = Math.ceil(imgData.width / 8);
    for (let y = 0; y < imgData.height; y++) {
      for (let x = 0; x < imgData.width; x++) {
        const byte = raw[y * rowBytes + (x >> 3)];
        const bit = (byte >> (7 - (x % 8))) & 1;
        out[y * imgData.width + x] = bit ? 255 : 0;
      }
    }
    raw = out;
  }
  const png = await sharp(raw, { raw: { width: imgData.width, height: imgData.height, channels } })
    .png()
    .toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}

async function processPage(page, pdfjsLib) {
  const [textContent, opList] = await Promise.all([page.getTextContent(), page.getOperatorList()]);
  const fontInfo = makeFontInfoResolver(page);
  const rawLines = buildLines(textContent, fontInfo);
  const { plainLines: lines, tables } = detectTables(rawLines);

  const rawImages = extractPageImages(page, opList, pdfjsLib);
  const images = [];
  for (const img of rawImages) {
    try {
      const src = await encodeImageToPng(img.data, pdfjsLib);
      // ctm[5] is the translated Y of the image's origin (bottom edge in PDF's
      // bottom-up space); ctm[3] is the Y-scale, i.e. the image's height in
      // user space for the common unrotated case — their sum approximates the
      // top edge, which is what we want to sort images against text lines by.
      images.push({ y: img.ctm[5] + img.ctm[3], src });
    } catch (e) {
      // Skip images we fail to decode rather than aborting the whole import.
    }
  }

  return { lines, images, tables };
}

/** Fold one page's lines+images (already merged and Y-sorted) into flat NormalizedItem-shaped entries, matching docxNormalizer's extractItems() output shape. */
function pageToItems(page, bodySize) {
  const items = [];
  const events = [
    ...page.lines.map((line) => ({ type: 'line', y: line.y, line })),
    ...page.images.map((img) => ({ type: 'image', y: img.y, img })),
    ...page.tables.map((t) => ({ type: 'table', y: t.y, rows: t.rows })),
  ];
  events.sort((a, b) => b.y - a.y);

  let paragraphBuffer = null; // { runs, lastY }
  let listBuffer = null; // { kind, runs, lastY }
  let headingBuffer = null; // { level, runs, lastY } — a heading that wraps onto a 2nd visual line

  const flushParagraph = () => {
    if (paragraphBuffer && paragraphBuffer.runs.length) {
      items.push({ kind: 'paragraph', inline: paragraphBuffer.runs });
    }
    paragraphBuffer = null;
  };
  const flushList = () => {
    if (listBuffer && listBuffer.runs.length) {
      items.push({ kind: listBuffer.kind, inline: listBuffer.runs, children: [] });
    }
    listBuffer = null;
  };
  const flushHeading = () => {
    if (headingBuffer && headingBuffer.runs.length) {
      items.push({ kind: 'heading', level: headingBuffer.level, inline: headingBuffer.runs });
    }
    headingBuffer = null;
  };

  for (const ev of events) {
    if (ev.type === 'image') {
      flushParagraph();
      flushList();
      flushHeading();
      items.push({ kind: 'image', src: ev.img.src, alt: '' });
      continue;
    }
    if (ev.type === 'table') {
      flushParagraph();
      flushList();
      flushHeading();
      items.push({ kind: 'table', rows: ev.rows });
      continue;
    }
    const line = ev.line;
    const text = line.runs
      .map((r) => r.text)
      .join('')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) continue;
    const maxSize = Math.max(...line.runs.map((r) => r.size));
    const continuationThreshold = maxSize * 1.7;

    const headingLevel = classifyHeadingLevel(maxSize, bodySize);
    if (headingLevel) {
      flushParagraph();
      flushList();
      // A long heading wraps onto a second visual line in the source PDF —
      // without this, each wrapped line was imported as its own separate
      // heading block, splitting (and visually duplicating) the title.
      if (headingBuffer && headingBuffer.level === headingLevel && headingBuffer.lastY - line.y <= continuationThreshold) {
        headingBuffer.runs.push({ text: ' ' }, ...lineToInlineRuns(line));
        headingBuffer.lastY = line.y;
      } else {
        flushHeading();
        headingBuffer = { level: headingLevel, runs: lineToInlineRuns(line), lastY: line.y };
      }
      continue;
    }
    flushHeading();

    const bulletMatch = text.match(BULLET_PATTERN);
    const numberedMatch = !bulletMatch && text.match(NUMBERED_PATTERN);
    if (bulletMatch || numberedMatch) {
      flushParagraph();
      flushList();
      const stripLen = (bulletMatch || numberedMatch)[0].length;
      listBuffer = {
        kind: bulletMatch ? 'bulletListItem' : 'numberedListItem',
        runs: lineToInlineRuns(line, stripLen),
        lastY: line.y,
      };
      continue;
    }

    // A wrapped continuation of the open list item (no marker, small gap).
    if (listBuffer && listBuffer.lastY - line.y <= continuationThreshold) {
      listBuffer.runs.push({ text: ' ' }, ...lineToInlineRuns(line));
      listBuffer.lastY = line.y;
      continue;
    }
    flushList();

    // A wrapped continuation of the open paragraph (no marker, small gap).
    if (paragraphBuffer && paragraphBuffer.lastY - line.y <= continuationThreshold) {
      paragraphBuffer.runs.push({ text: ' ' }, ...lineToInlineRuns(line));
      paragraphBuffer.lastY = line.y;
      continue;
    }
    flushParagraph();
    paragraphBuffer = { runs: lineToInlineRuns(line), lastY: line.y };
  }
  flushParagraph();
  flushList();
  flushHeading();

  return items;
}

function normalizeHeadingText(inline) {
  return inline
    .map((r) => r.text)
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// A page running header/footer, or a heading whose wrapped continuation line
// slipped past the merge above (e.g. a large Y-gap from an intervening
// page-break), shows up as two adjacent heading items with identical text —
// collapse them. Only ADJACENT duplicates are dropped, so two genuinely
// separate sections that happen to share a title elsewhere in the document
// are left alone.
function dedupeAdjacentHeadings(items) {
  const out = [];
  for (const item of items) {
    const prev = out[out.length - 1];
    if (
      item.kind === 'heading' &&
      prev &&
      prev.kind === 'heading' &&
      prev.level === item.level &&
      normalizeHeadingText(prev.inline) === normalizeHeadingText(item.inline)
    ) {
      continue;
    }
    out.push(item);
  }
  return out;
}

/**
 * @param {Buffer} buffer
 * @param {{ sourceFileName?: string }} [meta]
 * @returns {Promise<import('./types').NormalizedDocument>}
 */
async function parsePdfToNormalizedDocument(buffer, meta) {
  const sourceFileName = (meta && meta.sourceFileName) || 'document.pdf';
  const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true });
  const doc = await loadingTask.promise;

  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    pages.push(await processPage(page, pdfjsLib));
  }

  const bodySize = computeBodySize(pages.flatMap((p) => p.lines));
  const items = dedupeAdjacentHeadings(pages.flatMap((page) => pageToItems(page, bodySize)));
  const sections = groupIntoSections(items);

  return {
    metadata: {
      sourceFileName,
      sourceFileType: 'pdf',
      importedAt: new Date().toISOString(),
      // PDF has no real structure to recover (no headings/lists/tables in the
      // format itself) — everything here is inferred from layout, unlike
      // DOCX's high-fidelity styled-markup round trip.
      fidelity: 'lower',
      warnings: [],
      documentTitle: sourceFileName.replace(/\.[^.]+$/, ''),
    },
    sections,
  };
}

module.exports = { parsePdfToNormalizedDocument };
