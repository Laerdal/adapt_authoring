// Shared media/asset mapping for storyboard component cards (ADAPT-3760).
//
// This module has NO React/BlockNote dependency so it can be imported by both
// the editor card (componentBlock.tsx) and the persistence layer
// (api/adaptAuthoring.ts, api/storyboardGeneration.ts). It is the single source
// of truth for how a card's chosen asset maps to Adapt's `_graphic` / `_media`
// component fields and back.

// A selected asset. `link` is what persists into course data
// (`course/assets/<filename>` for DAM assets, or an external URL). `url` is a
// directly-loadable preview URL (`/api/asset/serve/<id>` or the external URL).
export interface AssetRef {
  assetId?: string; // DAM asset _id ("" / undefined for external)
  link?: string; // persisted value (course/assets/<filename> OR external URL)
  url?: string; // preview URL
  external?: boolean;
}

export interface ImageData extends AssetRef {
  alt: string;
}

export interface MediaData {
  asset?: AssetRef; // main video/audio source
  poster?: AssetRef; // video poster image
  transcriptSource: string;
  transcriptText: string;
  captionsSource: string;
  descriptionsSource: string;
  chaptersSource: string;
}

export function emptyMediaData(): MediaData {
  return {
    asset: undefined,
    poster: undefined,
    transcriptSource: "",
    transcriptText: "",
    captionsSource: "",
    descriptionsSource: "",
    chaptersSource: "",
  };
}

// ── Asset-link helpers ───────────────────────────────────────────────────────

const COURSE_ASSETS_PREFIX = "course/assets/";

export function isCourseAssetLink(link?: string): boolean {
  return !!link && link.startsWith(COURSE_ASSETS_PREFIX);
}

// The DAM filename (hash.ext) from a `course/assets/<filename>` link — this is
// the `_fieldName` used by the courseasset join collection.
export function filenameFromLink(link?: string): string {
  if (!link) return "";
  return isCourseAssetLink(link) ? link.slice(COURSE_ASSETS_PREFIX.length) : "";
}

// Turn a stored link into a loadable preview URL. Course assets are resolved to
// `/api/asset/serve/<id>` via the filename→assetId map; external URLs pass
// through unchanged.
export function resolveAssetUrl(link: string | undefined, idByFilename: Record<string, string>): string {
  if (!link) return "";
  if (!isCourseAssetLink(link)) return link; // external URL
  const id = idByFilename[filenameFromLink(link)];
  return id ? `/api/asset/serve/${id}` : link;
}

// Detect an external streaming provider for `_media.type`.
export function detectMediaType(link?: string): string {
  const l = (link || "").toLowerCase();
  if (l.includes("youtube.com") || l.includes("youtu.be")) return "video/youtube";
  if (l.includes("vimeo.com")) return "video/vimeo";
  return "";
}

// ── Card data → Adapt component fields ───────────────────────────────────────

// Image card → `_graphic` patch. Adapt's graphic component holds a single image
// in `large` (desktop) + `small` (mobile); we set both to the same source.
export function buildGraphicField(image?: ImageData): { _graphic: Record<string, unknown> } {
  const link = image?.link || "";
  return { _graphic: { large: link, small: link, alt: image?.alt || "" } };
}

// Video/audio card → `_media` patch. A DAM file goes into mp4 (video) / mp3
// (audio); an external URL goes into `source` (+ `type` for YouTube/Vimeo).
export function buildMediaField(kind: "video" | "audio", media?: MediaData): { _media: Record<string, unknown> } {
  const asset = media?.asset;
  const link = asset?.link || "";
  const external = !!asset?.external || (!!link && !isCourseAssetLink(link));
  const _media: Record<string, unknown> = {
    mp4: "",
    ogv: "",
    webm: "",
    mp3: "",
    source: "",
    type: "",
    poster: media?.poster?.link || "",
  };
  if (link) {
    if (external) {
      _media.source = link;
      _media.type = detectMediaType(link);
    } else if (kind === "audio") {
      _media.mp3 = link;
    } else {
      _media.mp4 = link;
    }
  }
  return { _media };
}

// ── Adapt component fields → card data (read-back) ───────────────────────────

interface GraphicShape {
  large?: string;
  small?: string;
  alt?: string;
}
interface MediaShape {
  mp4?: string;
  ogv?: string;
  webm?: string;
  mp3?: string;
  source?: string;
  type?: string;
  poster?: string;
}

export function imageFromGraphic(graphic: GraphicShape | undefined, idByFilename: Record<string, string>): ImageData {
  const link = (graphic && (graphic.large || graphic.small)) || "";
  return {
    link,
    url: resolveAssetUrl(link, idByFilename),
    alt: (graphic && graphic.alt) || "",
    external: !!link && !isCourseAssetLink(link),
  };
}

// Returns the card kind ('video' | 'audio') implied by which fields are set,
// plus the reconstructed MediaData.
export function mediaFromComponent(
  media: MediaShape | undefined,
  idByFilename: Record<string, string>
): { kind: "video" | "audio"; data: MediaData } {
  const m = media || {};
  const isAudio = !!m.mp3 && !m.mp4 && !m.webm && !m.ogv;
  const link = m.mp4 || m.webm || m.ogv || m.mp3 || m.source || "";
  const external = !!m.source && !m.mp4 && !m.mp3;
  const data = emptyMediaData();
  if (link) {
    data.asset = { link, url: resolveAssetUrl(link, idByFilename), external };
  }
  if (m.poster) {
    data.poster = { link: m.poster, url: resolveAssetUrl(m.poster, idByFilename) };
  }
  return { kind: isAudio ? "audio" : "video", data };
}
