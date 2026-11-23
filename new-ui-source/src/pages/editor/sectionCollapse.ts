import { useCallback, useRef, useState } from "react";

/**
 * ADAPT-3948 — Page Editor section collapse/expand (view-only state).
 *
 * Collapsed sections are tracked per topic, in memory only. Nothing here is
 * persisted, saved, or merged into contentPages; collapse is a CSS-only
 * presentation of the canvas iframe so inline editors stay mounted.
 */
export type CollapsedByTopic = Record<string, Record<string, true>>;

export const SECTION_COLLAPSED_CLASS = "adapt-authoring-section-collapsed";
export const SECTION_BODY_ID_PREFIX = "adapt-authoring-section-body-";

const EMPTY: Record<string, true> = Object.freeze({}) as Record<string, true>;

export const isCollapsed = (state: CollapsedByTopic, topicId: string, articleId: string): boolean =>
  Boolean(state[topicId]?.[articleId]);

const withTopic = (state: CollapsedByTopic, topicId: string, next: Record<string, true>): CollapsedByTopic => {
  if (Object.keys(next).length === 0) {
    if (!(topicId in state)) return state;
    const { [topicId]: _removed, ...rest } = state;
    return rest;
  }
  return { ...state, [topicId]: next };
};

export const toggleSection = (state: CollapsedByTopic, topicId: string, articleId: string): CollapsedByTopic => {
  const current = state[topicId] ?? EMPTY;
  if (current[articleId]) {
    const { [articleId]: _removed, ...rest } = current;
    return withTopic(state, topicId, rest);
  }
  return withTopic(state, topicId, { ...current, [articleId]: true });
};

export const collapseAll = (state: CollapsedByTopic, topicId: string, articleIds: string[]): CollapsedByTopic => {
  const current = state[topicId] ?? EMPTY;
  if (articleIds.every((id) => current[id])) return state;
  const next: Record<string, true> = { ...current };
  articleIds.forEach((id) => { next[id] = true; });
  return withTopic(state, topicId, next);
};

export const expandAll = (state: CollapsedByTopic, topicId: string): CollapsedByTopic =>
  withTopic(state, topicId, {});

/** Expands the article holding a selection. Returns the same object if nothing changes. */
export const expandForSelection = (state: CollapsedByTopic, topicId: string | null, articleId: string | null): CollapsedByTopic => {
  if (!topicId || !articleId || !isCollapsed(state, topicId, articleId)) return state;
  return toggleSection(state, topicId, articleId);
};

/** Drops collapsed ids for articles that no longer exist in the topic. Same object if unchanged. */
export const pruneTopic = (state: CollapsedByTopic, topicId: string, existingArticleIds: string[]): CollapsedByTopic => {
  const current = state[topicId];
  if (!current) return state;
  const keep = new Set(existingArticleIds);
  const ids = Object.keys(current);
  if (ids.every((id) => keep.has(id))) return state;
  const next: Record<string, true> = {};
  ids.forEach((id) => { if (keep.has(id)) next[id] = true; });
  return withTopic(state, topicId, next);
};

export const stripHtml = (value: string | null | undefined): string =>
  String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();

export const getSectionTitleText = (title: string | null | undefined): string => stripHtml(title) || "Untitled";

export const getToggleLabel = (title: string | null | undefined, collapsed: boolean): string =>
  `${collapsed ? "Expand" : "Collapse"} ${getSectionTitleText(title)} section`;

export function useSectionCollapse() {
  const [collapsedByTopic, setCollapsedByTopic] = useState<CollapsedByTopic>({});
  // Mirror for observers / iframe click callbacks that outlive a render.
  const collapsedRef = useRef<CollapsedByTopic>(collapsedByTopic);
  collapsedRef.current = collapsedByTopic;

  const update = useCallback((fn: (state: CollapsedByTopic) => CollapsedByTopic) => {
    const next = fn(collapsedRef.current);
    if (next === collapsedRef.current) return;
    collapsedRef.current = next;
    setCollapsedByTopic(next);
  }, []);

  const toggle = useCallback((topicId: string, articleId: string) => update((s) => toggleSection(s, topicId, articleId)), [update]);
  const collapseAllIn = useCallback((topicId: string, ids: string[]) => update((s) => collapseAll(s, topicId, ids)), [update]);
  const expandAllIn = useCallback((topicId: string) => update((s) => expandAll(s, topicId)), [update]);
  const expandForArticle = useCallback((topicId: string | null, articleId: string | null) => update((s) => expandForSelection(s, topicId, articleId)), [update]);
  const prune = useCallback((topicId: string, ids: string[]) => update((s) => pruneTopic(s, topicId, ids)), [update]);

  return { collapsedByTopic, collapsedRef, toggle, collapseAllIn, expandAllIn, expandForArticle, prune };
}

// Minus = expanded (click to collapse), plus = collapsed (click to expand); 16px
// stroke icons matching the other level action icons.
const MINUS_SVG =
  '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><path d="M3.5 8h9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
const PLUS_SVG =
  '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><path d="M3.5 8h9M8 3.5v9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

const setAttr = (el: Element, name: string, value: string) => {
  if (el.getAttribute(name) !== value) el.setAttribute(name, value);
};

/**
 * Ensures the section collapse toggle exists as the LAST icon of a section
 * level-actions group ([data-preview-level-actions]) and refreshes its state.
 * Diff-before-write so a MutationObserver watching the canvas does not feed
 * back into itself.
 */
export function ensureSectionToggleButton(
  doc: Document,
  actions: HTMLElement,
  article: { id: string; title: string },
  isOpen: boolean
): HTMLButtonElement {
  let btn = actions.querySelector<HTMLButtonElement>("[data-preview-section-collapse-btn]");
  if (!btn) {
    btn = doc.createElement("button");
    btn.type = "button";
    btn.className = "adapt-authoring-level-action-btn adapt-authoring-section-collapse-btn";
    btn.setAttribute("data-preview-section-collapse-btn", "true");
  }
  if (actions.lastElementChild !== btn) actions.appendChild(btn);
  setAttr(btn, "data-preview-section-article-id", article.id);
  setAttr(btn, "aria-expanded", String(isOpen));
  const label = getToggleLabel(article.title, !isOpen);
  setAttr(btn, "aria-label", label);
  setAttr(btn, "title", label);
  const icon = isOpen ? "minus" : "plus";
  if (btn.getAttribute("data-icon") !== icon) {
    setAttr(btn, "data-icon", icon);
    btn.innerHTML = isOpen ? MINUS_SVG : PLUS_SVG;
  }
  const body = actions.closest(".article")?.querySelector<HTMLElement>(".block__container");
  if (body) {
    if (!body.id) body.id = `${SECTION_BODY_ID_PREFIX}${article.id}`;
    setAttr(btn, "aria-controls", body.id);
  }
  return btn;
}

interface SyncArticle { id: string; title: string; blocks: Array<unknown> }

/**
 * Refreshes section collapse state in the preview iframe: the collapsed class
 * on each .article and the toggle button inside the section's level-actions
 * group. Collapsed sections always get a (toggle-only) group so they can be
 * re-expanded; expanded sections only keep one while hovered/selected (owned by
 * ensureLevelActionIcons), and a toggle-only group left from a collapsed
 * state is removed. Writes only when a value differs.
 */
export function syncSectionCollapseControls(
  doc: Document,
  { page, collapsed }: { page: { id: string; articles: SyncArticle[] }; collapsed: Record<string, true> | undefined }
): void {
  const liveIds = new Set<string>();

  page.articles.forEach((article) => {
    const articleNode = doc.querySelector<HTMLElement>(`.article[data-adapt-id="${article.id}"]`);
    const inner = articleNode?.querySelector<HTMLElement>(".article__inner") ?? null;
    if (!articleNode || !inner) return;
    liveIds.add(article.id);
    const isOpen = !collapsed?.[article.id];

    if (articleNode.classList.contains(SECTION_COLLAPSED_CLASS) === isOpen) {
      articleNode.classList.toggle(SECTION_COLLAPSED_CLASS, !isOpen);
    }

    let host = inner.querySelector<HTMLElement>(".article__header-inner");
    let actions = host?.querySelector<HTMLElement>(":scope > [data-preview-level-actions]") ?? null;

    if (isOpen) {
      if (actions) {
        if (actions.getAttribute("data-preview-actions-collapsed-only") === "true") {
          // Nothing but the toggle was shown for the collapsed state.
          actions.remove();
        } else {
          ensureSectionToggleButton(doc, actions, article, true);
        }
      }
      return;
    }

    // Collapsed: make sure there is a header host (headless sections may have none).
    if (!host) {
      let header = inner.querySelector<HTMLElement>(".article__header");
      if (!header) {
        header = doc.createElement("div");
        header.className = "article__header";
        header.setAttribute("data-preview-injected", "true");
        inner.insertBefore(header, inner.firstChild);
      }
      host = doc.createElement("div");
      host.className = "article__header-inner";
      host.setAttribute("data-preview-injected", "true");
      header.appendChild(host);
    }
    if (!actions) {
      actions = doc.createElement("div");
      actions.className = "adapt-authoring-level-actions";
      actions.setAttribute("data-preview-level-actions", "true");
      actions.setAttribute("data-preview-action-level", "section");
      actions.setAttribute("data-preview-action-page-id", page.id);
      actions.setAttribute("data-preview-action-article-id", article.id);
      actions.setAttribute("data-preview-actions-selected", "false");
      actions.setAttribute("data-preview-actions-collapsed-only", "true");
      host.appendChild(actions);
    }
    ensureSectionToggleButton(doc, actions, article, false);
  });

  doc.querySelectorAll<HTMLElement>(`.${SECTION_COLLAPSED_CLASS}`).forEach((node) => {
    const id = node.getAttribute("data-adapt-id");
    if (!id || !liveIds.has(id)) node.classList.remove(SECTION_COLLAPSED_CLASS);
  });
  doc.querySelectorAll<HTMLElement>('[data-preview-level-actions][data-preview-action-level="section"][data-preview-actions-collapsed-only="true"]').forEach((node) => {
    const id = node.getAttribute("data-preview-action-article-id");
    if (!id || !liveIds.has(id)) node.remove();
  });
}
