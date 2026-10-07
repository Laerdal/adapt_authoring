import { describe, expect, it, vi } from 'vitest';
import zlib from 'node:zlib';

import { resolveAnyImage } from '../../../plugins/content/storyboard/utils/assetResolver.js';
import {
  blocksToDocx,
  blocksToPdf,
} from '../../../plugins/content/storyboard/utils/documentConvert.js';

// pdfkit's content streams are Deflate-compressed by default, so asserting
// "the SVG actually got drawn" requires inflating them rather than grepping
// the raw PDF bytes. A raster `doc.image()` embed shows up as an `/Image`
// XObject `Do` reference; a vector `svg-to-pdfkit` draw shows up as literal
// path-construction operators (moveto/lineto/closepath/fill) tracing the
// SVG's actual shapes — distinguishing "drew a vector" from "drew a raster"
// from "didn't draw anything" (text-only fallback).
function inflatePdfStreams(pdfBuffer: Buffer): string {
  const str = pdfBuffer.toString('latin1');
  const streamRe = /stream\r?\n([\s\S]*?)endstream/g;
  const chunks: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = streamRe.exec(str))) {
    const raw = Buffer.from(match[1], 'latin1');
    try {
      chunks.push(zlib.inflateSync(raw).toString('latin1'));
    } catch {
      chunks.push(raw.toString('latin1'));
    }
  }
  return chunks.join('\n');
}

describe('storyboard asset handling', () => {
  it('preserves PNG data URIs for export', async () => {
    const pngBytes = Buffer.from([
      137, 80, 78, 71, 13, 10, 26, 10,
      0, 0, 0, 13, 73, 72, 68, 82,
      0, 0, 0, 1, 0, 0, 0, 1,
      8, 6, 0, 0, 0, 31, 21, 196,
      137,
    ]);

    const result = await resolveAnyImage({
      link: `data:image/png;base64,${pngBytes.toString('base64')}`,
      alt: 'png-image',
    });

    expect(result).not.toBeNull();
    expect(result?.type).toBe('png');
    expect(result?.buffer.equals(pngBytes)).toBe(true);
    expect(result?.width).toBeGreaterThan(0);
    expect(result?.height).toBeGreaterThan(0);
  });

  it('keeps SVG data URIs as native vector images with a rasterized fallback', async () => {
    // Word (docx asvg:svgBlip) and PDF (svg-to-pdfkit) both render the SVG
    // natively now rather than requiring it be flattened to PNG — see
    // normalizeImageForEmbedding's comment for why sharp is no longer a hard
    // dependency for the embed to happen at all. `fallback` is only used by
    // apps/old-Word that can't render the SVG blip, or if svg-to-pdfkit can't
    // parse a particular SVG.
    const svg = Buffer.from(`
      <svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80">
        <rect width="120" height="80" fill="#000" />
      </svg>
    `);

    const result = await resolveAnyImage({
      link: `data:image/svg+xml;base64,${svg.toString('base64')}`,
      alt: 'svg-image',
    });

    expect(result).not.toBeNull();
    expect(result?.type).toBe('svg');
    expect(result?.buffer.equals(svg)).toBe(true);

    const embedded = await (await import('../../../plugins/content/storyboard/utils/assetResolver.js')).normalizeImageForEmbedding(result);
    expect(embedded).not.toBeNull();
    expect(embedded?.type).toBe('svg');
    expect(embedded?.buffer.toString('utf8')).toContain('<svg');
    expect(embedded?.fallback?.type).toBe('png');
    expect(embedded?.fallback?.buffer.length).toBeGreaterThan(0);
  });

  it('resolves URL-encoded SVG data URIs for export, kept as native vector', async () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80">
        <rect width="120" height="80" fill="#000" />
      </svg>
    `;

    const result = await resolveAnyImage({
      link: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
      alt: 'svg-image-encoded',
    });

    expect(result).not.toBeNull();
    expect(result?.type).toBe('svg');
    expect(result?.buffer.toString('utf8')).toContain('<svg');

    const embedded = await (await import('../../../plugins/content/storyboard/utils/assetResolver.js')).normalizeImageForEmbedding(result);
    expect(embedded).not.toBeNull();
    expect(embedded?.type).toBe('svg');
    expect(embedded?.fallback?.type).toBe('png');
    expect(embedded?.fallback?.buffer.length).toBeGreaterThan(0);
  });

  it('creates a valid docx when an SVG is embedded', async () => {
    const svg = Buffer.from(`
      <svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80">
        <rect width="120" height="80" fill="#000" />
      </svg>
    `);

    const docxBuffer = await blocksToDocx(
      [{ type: 'sbComponent', props: { kind: 'image', title: 'SVG image', data: JSON.stringify({ image: { link: `data:image/svg+xml;base64,${svg.toString('base64')}`, alt: 'svg-image' } }) } }],
      'SVG Export',
    );

    expect(docxBuffer).toBeInstanceOf(Buffer);
    expect(docxBuffer.length).toBeGreaterThan(0);
    expect(docxBuffer.slice(0, 2).toString('hex')).toBe('504b');
  });

  it('embeds the SVG natively with a placeholder fallback when sharp cannot rasterize it', async () => {
    // Reproduces the real "SVG exports as a path only, PNG/JPG work fine"
    // production report, which traced back to two stacked bugs:
    //   1. pushImageRef did `resolved = (await normalizeImageForEmbedding(x)) || resolved`,
    //      reviving the original un-rasterized `{ type: 'svg' }` object on
    //      failure and handing it to docx's ImageRun, which throws because it
    //      requires a `fallback` raster whenever type is 'svg' — caught and
    //      logged as an opaque "image embed failed", masking the real cause.
    //   2. Even once that was fixed to degrade cleanly, the *entire* SVG
    //      embed still depended on sharp/librsvg successfully rasterizing —
    //      a common real-world failure on deployed platforms whose sharp
    //      binary lacks full librsvg support — so a broken sharp install
    //      meant SVGs never embedded at all, regardless of the first fix.
    // The real fix: Word 2016+ renders SVG natively via docx's own
    // `asvg:svgBlip` extension, so the SVG doesn't need rasterizing to
    // embed — sharp's PNG render is only ever used for docx's mandatory
    // `fallback` (shown by apps/old-Word that can't render the SVG blip
    // natively), and falls back to an inert placeholder when sharp fails.
    // This SVG is deliberately malformed enough that sharp fails on both the
    // raw and sanitized retry, proving the embed still goes ahead natively.
    const unrasterizableSvg = Buffer.from('<svg><this is not valid xml and sanitize cannot fix it');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const docxBuffer = await blocksToDocx(
        [
          {
            type: 'sbComponent',
            props: {
              kind: 'image',
              title: 'Broken SVG',
              data: JSON.stringify({
                image: { link: `data:image/svg+xml;base64,${unrasterizableSvg.toString('base64')}`, alt: 'broken-svg' },
              }),
            },
          },
        ],
        'Broken SVG Export',
      );

      expect(docxBuffer).toBeInstanceOf(Buffer);
      expect(docxBuffer.length).toBeGreaterThan(0);
      expect(docxBuffer.slice(0, 2).toString('hex')).toBe('504b');

      // Must not hit pushImageRef's catch (the masked-exception bug) — only
      // the expected, informational sharp-rasterization-failed log is OK.
      const embedFailureLogged = errorSpy.mock.calls.some((call) =>
        String(call[0]).includes('image embed failed'),
      );
      expect(embedFailureLogged).toBe(false);

      const { default: JSZip } = await import('jszip');
      const zip = await JSZip.loadAsync(docxBuffer);
      const mediaFiles = Object.keys(zip.files).filter((name) => name.startsWith('word/media/'));
      expect(mediaFiles.some((name) => name.endsWith('.svg'))).toBe(true);
      expect(mediaFiles.some((name) => name.endsWith('.png'))).toBe(true);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('embeds a valid SVG natively alongside its rasterized PNG fallback', async () => {
    const svg = Buffer.from(`
      <svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80">
        <rect width="120" height="80" fill="#000" />
      </svg>
    `);

    const docxBuffer = await blocksToDocx(
      [
        {
          type: 'sbComponent',
          props: {
            kind: 'image',
            title: 'Good SVG',
            data: JSON.stringify({
              image: { link: `data:image/svg+xml;base64,${svg.toString('base64')}`, alt: 'good-svg' },
            }),
          },
        },
      ],
      'Valid SVG Export',
    );

    expect(docxBuffer).toBeInstanceOf(Buffer);
    expect(docxBuffer.slice(0, 2).toString('hex')).toBe('504b');

    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(docxBuffer);
    const mediaFiles = Object.keys(zip.files).filter((name) => name.startsWith('word/media/'));
    expect(mediaFiles.some((name) => name.endsWith('.svg'))).toBe(true);
    expect(mediaFiles.some((name) => name.endsWith('.png'))).toBe(true);

    // The document's own text should not contain the fallback-only text
    // reference — the image embedded, it wasn't dropped to a bracketed path.
    const docXml = await zip.file('word/document.xml')?.async('string');
    expect(docXml).not.toContain('[Image —');
  });

  it('draws SVGs as real vector paths in the PDF export, not a raster or text fallback', async () => {
    // pdfkit's own doc.image() has no SVG support at all — this exercises
    // the svg-to-pdfkit integration (pdfDrawImageAt in documentConvert.js)
    // that replaced the old sharp-rasterize-or-give-up behaviour. A 120×80
    // solid black rect is simple enough that svg-to-pdfkit emits exactly the
    // path operators below, which a raster XObject embed would never
    // contain (those use `/Image Do`, not literal moveto/lineto/fill ops).
    const svg = Buffer.from(`
      <svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80">
        <rect width="120" height="80" fill="#000" />
      </svg>
    `);

    const pdfBuffer = await blocksToPdf(
      [
        {
          type: 'sbComponent',
          props: {
            kind: 'image',
            title: 'Good SVG',
            data: JSON.stringify({
              image: { link: `data:image/svg+xml;base64,${svg.toString('base64')}`, alt: 'good-svg' },
            }),
          },
        },
      ],
      'Valid SVG PDF Export',
    );

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.slice(0, 4).toString('ascii')).toBe('%PDF');

    const content = inflatePdfStreams(pdfBuffer);
    expect(content).not.toContain('[Image -');
    // The rect's four corners traced via moveto(m)/lineto(l)/closepath(h)/fill(f).
    expect(content).toContain('0 0 m');
    expect(content).toContain('120 0 l');
    expect(content).toContain('120 80 l');
    expect(content).toContain('0 80 l');
    expect(/\bf\b/.test(content)).toBe(true);
  });
});

describe('legacy storyboard compatibility', () => {
  it('can export a legacy storyboard document that still contains placeholder titles', async () => {
    const blocks = [
      { type: 'heading', props: { level: 1 }, content: 'New Topic Title' },
      { type: 'heading', props: { level: 2 }, content: 'New Section Title' },
      { type: 'heading', props: { level: 3 }, content: 'New Content Group Title' },
      { type: 'paragraph', content: 'Legacy storyboard text should still export cleanly.' },
    ];

    const docxBuffer = await blocksToDocx(blocks, 'Legacy Storyboard Export');
    expect(docxBuffer).toBeInstanceOf(Buffer);
    expect(docxBuffer.length).toBeGreaterThan(0);
    expect(docxBuffer.slice(0, 2).toString('hex')).toBe('504b');

    const pdfBuffer = await blocksToPdf(blocks, 'Legacy Storyboard Export');
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(0);
    expect(pdfBuffer.slice(0, 4).toString('ascii')).toBe('%PDF');
  });
});
