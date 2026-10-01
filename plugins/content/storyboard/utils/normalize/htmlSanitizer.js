// Single choke point for sanitizing Mammoth-generated HTML before any of it
// is walked into NormalizedDocument blocks (ADAPT-3760 storyboard import).
// Whitelists only the tags/attributes the docx normalizer knows how to
// convert into BlockNote content — everything else (scripts, styles, iframes,
// event handlers, unknown tags) is stripped rather than passed through.

const sanitizeHtml = require('sanitize-html');

const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br',
  'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'sub', 'sup', 'a',
  'ul', 'ol', 'li',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'img',
];

// Word's "Title" style is remapped (via docxNormalizer's mammoth styleMap)
// to `<p class="sb-doc-title">` so it can be recognized as the document
// title rather than stray body text — this is the one class this sanitizer
// lets through, and only this exact value.
const OPTIONS = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    a: ['href'],
    img: ['src', 'alt'],
    p: ['class'],
  },
  allowedClasses: {
    p: ['sb-doc-title'],
  },
  // Only http(s) links; only data:image/* or http(s) images — blocks
  // javascript:/data:text/html and similar script-execution vectors.
  allowedSchemes: ['http', 'https'],
  allowedSchemesByTag: {
    img: ['data', 'http', 'https'],
  },
  allowedSchemesAppliedToAttributes: ['href', 'src'],
  exclusiveFilter: (frame) => frame.tag === 'img' && !/^(data:image\/|https?:\/\/)/i.test(frame.attribs.src || ''),
  // Drop the content of anything not in the whitelist (scripts/styles/etc.)
  // rather than un-wrapping it into the surrounding text.
  nonTextTags: ['script', 'style', 'head', 'title', 'iframe', 'object', 'embed'],
};

/** Sanitize raw Mammoth HTML down to the whitelist above. */
function sanitizeMammothHtml(html) {
  return sanitizeHtml(String(html || ''), OPTIONS);
}

module.exports = { sanitizeMammothHtml, ALLOWED_TAGS };
