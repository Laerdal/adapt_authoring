// BlockNote implementation of the storyboard editor.
//
// The ONLY files that know about BlockNote are this one, schema.ts and
// blocks/*. Everything else depends on the engine-agnostic
// `StoryboardEditorHandle` from `@/types/storyboard`.

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { filterSuggestionItems, type PartialBlock } from '@blocknote/core';
import { BlockNoteView } from '@blocknote/mantine';
import {
  blockTypeSelectItems,
  FormattingToolbar,
  FormattingToolbarController,
  getDefaultReactSlashMenuItems,
  getFormattingToolbarItems,
  SuggestionMenuController,
  useBlockNoteEditor,
  useComponentsContext,
  useCreateBlockNote,
  useEditorState,
  type DefaultReactSuggestionItem,
} from '@blocknote/react';
import { Subscript as SubscriptIcon, Superscript as SuperscriptIcon } from 'lucide-react';

import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';

import {
  adaptTypeForLevel,
  defaultAssessmentData,
  INSERT_META,
  isAssessmentKind,
  type ActiveBlockInfo,
  type AssessmentKind,
  type PlaceholderCategory,
  type StoryboardDocument,
  type StoryboardEditorHandle,
  type StoryboardEditorProps,
  type StoryboardHeading,
  type StoryboardInsertKind,
  type StoryboardSummary,
} from '@/types/storyboard';
import { NEW_TOPIC_TITLE, NEW_SECTION_TITLE, NEW_CONTENT_GROUP_TITLE } from '@/constants/structureDefaults';
import { storyboardSchema } from './schema';
import { makeComponentBlock, isComponentKind, COMPONENT_META, type ComponentKind } from './blocks/componentBlock';
import { ASSESSMENT_LABELS } from './blocks/assessmentBlock';
import { inlineText, resolveCommentAnchor, resolveInsertionAnchor } from './commentAnchor';
import { MAX_COMPONENTS_PER_BLOCK, parseDocToTree } from '@/api/storyboardGeneration';

// Toggle button for the subscript/superscript styles added to storyboardSchema
// (schema.ts) — BlockNote's own BasicTextStyleButton can't be reused here: its
// icon map and tooltip lookup are hardcoded to bold/italic/underline/strike/
// code, so passing "subscript"/"superscript" through it throws (no dictionary
// entry). Same toggle/active-state logic, our own icon + label instead.
function ScriptStyleButton({
  styleKey,
  label,
  Icon,
}: {
  styleKey: 'subscript' | 'superscript';
  label: string;
  Icon: typeof SubscriptIcon;
}) {
  const Components = useComponentsContext()!;
  const editor = useBlockNoteEditor();
  const state = useEditorState({
    editor,
    selector: ({ editor }) => {
      if (!editor.isEditable) return undefined;
      if (!(styleKey in editor.schema.styleSchema)) return undefined;
      const hasInlineContent = (
        editor.getSelection()?.blocks || [editor.getTextCursorPosition().block]
      ).some((block) => block.content !== undefined);
      if (!hasInlineContent) return undefined;
      return { active: styleKey in editor.getActiveStyles() };
    },
  });
  if (!state) return null;
  return (
    <Components.FormattingToolbar.Button
      className="bn-button"
      onClick={() => {
        editor.focus();
        editor.toggleStyles({ [styleKey]: true } as never);
      }}
      isSelected={state.active}
      label={label}
      mainTooltip={label}
      icon={<Icon size={16} />}
    />
  );
}

// "Add Content" kinds that map to the rich component card (sbComponent).
const COMPONENT_CARD_KINDS = new Set<StoryboardInsertKind>([
  'text',
  'groupedContent',
  'image',
  'video',
  'audio',
  'h5p',
  'laerdalForm',
]);

const DEFAULT_CONTENT: PartialBlock[] = [
  { type: 'heading', props: { level: 1 }, content: 'New Page Title' },
  { type: 'heading', props: { level: 2 }, content: 'New Section Title' },
  { type: 'paragraph', content: '' },
];

const ASSET_TYPES = new Set(['image', 'video', 'audio']);

// Strip literal/stray HTML tag markup (e.g. a `<br>`/`</br>` a Word import or
// paste carried over as literal text) from TOC labels — the Contents panel
// renders plain text, so a tag string shows up verbatim as visible junk
// instead of ever being interpreted as markup.
function stripTagLikeText(text: string): string {
  return text.replace(/<\/?[a-zA-Z][^>]*>/g, '').trim();
}

// Neutral insert kind → a concrete BlockNote block. Returns a loose shape; the
// call site casts to the editor's block type.
//   heading                     → heading block
//   text/grouped/image/…/form   → rich component card (sbComponent, AC3)
//   mcq/gmcq/…                   → assessment card (sbAssessment, AC5)
//   hotgraphic/…/instruction    → metadata placeholder (sbPlaceholder, AC6)
const DEFAULT_HEADING_TITLE_BY_LEVEL: Record<number, string> = {
  1: NEW_TOPIC_TITLE,
  2: NEW_SECTION_TITLE,
  3: NEW_CONTENT_GROUP_TITLE,
};

function blockForKind(kind: StoryboardInsertKind, level = 1): Record<string, unknown> {
  if (kind === 'heading') {
    return { type: 'heading', props: { level }, content: DEFAULT_HEADING_TITLE_BY_LEVEL[level] || 'New heading' };
  }
  if (COMPONENT_CARD_KINDS.has(kind)) return makeComponentBlock(kind as ComponentKind);

  const meta = INSERT_META[kind as keyof typeof INSERT_META];
  if (isAssessmentKind(kind)) {
    return {
      type: 'sbAssessment',
      props: { kind, title: '', adaptComponent: meta.adaptComponent, data: JSON.stringify(defaultAssessmentData(kind)) },
    };
  }
  return {
    type: 'sbPlaceholder',
    props: { label: meta.label, category: meta.category, adaptComponent: meta.adaptComponent },
  };
}

function BlockNoteStoryboardEditorImpl(
  { initialDocument, editable = true, onChange, onActiveBlock, onWarning }: StoryboardEditorProps,
  ref: React.Ref<StoryboardEditorHandle>
) {
  const editor = useCreateBlockNote({
    schema: storyboardSchema,
    initialContent:
      Array.isArray(initialDocument) && initialDocument.length
        ? (initialDocument as PartialBlock[])
        : DEFAULT_CONTENT,
  });

  // Badge + label for a content-item block (sbComponent/sbAssessment/
  // sbPlaceholder/native asset) — used to give it a Structure-panel row of its
  // own. Without this, the Structure panel can only navigate to the enclosing
  // Content Group heading: several MCQ/Image cards in the same group would
  // share that one row, so clicking it scrolls to the group but leaves every
  // item inside it visually indistinguishable from its siblings.
  const itemRowInfo = useCallback((block: (typeof editor.document)[number]): { badge: string; text: string } | null => {
    if (block.type === 'sbComponent') {
      const kind = (block.props as { kind?: string }).kind as ComponentKind | undefined;
      const title = String((block.props as { title?: string }).title || '');
      const badge = (kind && COMPONENT_META[kind]?.badge) || kind || 'Content';
      return { badge, text: title || badge };
    }
    if (block.type === 'sbAssessment') {
      const kind = (block.props as { kind?: string }).kind as AssessmentKind | undefined;
      const title = String((block.props as { title?: string }).title || '');
      const badge = (kind && ASSESSMENT_LABELS[kind]) || kind || 'Assessment';
      return { badge, text: title || badge };
    }
    if (block.type === 'sbPlaceholder') {
      const label = String((block.props as { label?: string }).label || 'Content');
      const title = String((block.props as { title?: string }).title || '');
      return { badge: label, text: title || label };
    }
    if (ASSET_TYPES.has(block.type)) {
      const badge = block.type.charAt(0).toUpperCase() + block.type.slice(1);
      return { badge, text: inlineText(block.content) || badge };
    }
    return null;
  }, []);

  // Per spec, a Content Group (or whatever heading currently contains the
  // insertion point) holds at most MAX_COMPONENTS_PER_BLOCK components —
  // generation (storyboardGeneration.ts enforceMaxComponentsPerBlock) will
  // split an overflowing group into extra Adapt blocks rather than reject it,
  // but that split isn't reflected back into the storyboard document itself,
  // which is what produced the "Storyboard says 1 group, Editor shows 2
  // blocks" mismatch. Enforcing the limit here, at insert time, keeps the
  // document's own structure truthful to what will actually get generated.
  //
  // This MUST count using parseDocToTree's own aggregation rules, not a
  // simplified re-implementation — an H3 group's "component count" at
  // generation time isn't "one per sbComponent/sbAssessment/asset row": a
  // native paragraph/list/table with real text also becomes a Text
  // component, an H4 heading starts a new one, and consecutive
  // paragraphs/lists/tables under one open H4 (or under no heading at all)
  // fold into that SAME component rather than each counting separately. A
  // row-counting approximation (e.g. only counting Contents-panel rows)
  // undercounts native paragraph/list/table/H4 content, silently allowing
  // the exact overflow this check exists to prevent. Reusing parseDocToTree
  // directly keeps this in lockstep with generation by construction instead
  // of by two hand-maintained implementations staying in sync.
  const componentsInContainer = useCallback(
    (anchorBlockId: string, doc: unknown[] = editor.document as unknown[]): number => {
      const tree = parseDocToTree(doc, () => undefined);
      for (const topic of tree) {
        for (const section of topic.sections) {
          for (const group of section.groups) {
            if (group.sourceBlockId === anchorBlockId) return group.components.length;
            if (group.components.some((c: { sourceBlockId?: string }) => c.sourceBlockId === anchorBlockId)) {
              return group.components.length;
            }
          }
        }
      }
      return 0;
    },
    [editor]
  );

  // Shared by every path that can add a generated component to a Content
  // Group (Add Content, AI Assistance → Insert, the H4 slash-menu item) so a
  // capacity rejection can never drift between them (Copilot review finding:
  // insertComponent/the H4 command bypassed this check entirely before).
  const checkGroupCapacity = useCallback(
    (anchorBlockId: string): { ok: boolean; warning?: string } => {
      if (componentsInContainer(anchorBlockId) < MAX_COMPONENTS_PER_BLOCK) return { ok: true };
      return {
        ok: false,
        warning:
          MAX_COMPONENTS_PER_BLOCK === 1
            ? 'This Content Group already has a component. Add a new Content Group (H3) for more.'
            : `A Content Group can hold up to ${MAX_COMPONENTS_PER_BLOCK} components. Add a new Content Group (H3) for more.`,
      };
    },
    [componentsInContainer]
  );

  const getHeadings = useCallback((): StoryboardHeading[] => {
    const out: StoryboardHeading[] = [];
    let currentLevel = 0;
    for (const block of editor.document) {
      if (block.type === 'heading') {
        const level = Number((block.props as { level?: number }).level ?? 1);
        currentLevel = level;
        out.push({
          id: block.id,
          level,
          text: stripTagLikeText(inlineText(block.content)),
          adaptType: adaptTypeForLevel(level),
        });
        continue;
      }
      const item = itemRowInfo(block);
      if (!item) continue;
      const level = Math.min(4, Math.max(2, currentLevel + 1));
      out.push({
        id: block.id,
        level,
        text: stripTagLikeText(item.text),
        adaptType: 'component',
        isItem: true,
        itemBadge: item.badge,
      });
    }
    return out;
  }, [editor, itemRowInfo]);

  const getSummary = useCallback((): StoryboardSummary => {
    let topics = 0;
    let sections = 0;
    let contentItems = 0;
    let assets = 0;
    let textBlocks = 0;
    let hasVisual = false;
    let hasAssessment = false;

    for (const block of editor.document) {
      if (block.type === 'heading') {
        const level = Number((block.props as { level?: number }).level ?? 1);
        if (level === 1) topics += 1;
        else if (level === 2) sections += 1;
        continue;
      }
      if (ASSET_TYPES.has(block.type)) {
        assets += 1;
        contentItems += 1;
        if (block.type === 'image' || block.type === 'video') hasVisual = true;
        continue;
      }
      if (block.type === 'sbAssessment') {
        contentItems += 1;
        hasAssessment = true;
        continue;
      }
      if (block.type === 'sbComponent') {
        contentItems += 1;
        const k = (block.props as { kind?: string }).kind;
        if (k === 'image' || k === 'video') hasVisual = true;
        if (k === 'image' || k === 'video' || k === 'audio') assets += 1;
        continue;
      }
      if (block.type === 'sbPlaceholder') {
        contentItems += 1;
        if ((block.props as { category?: PlaceholderCategory }).category === 'assessment') {
          hasAssessment = true;
        }
        continue;
      }
      if (block.type === 'paragraph' && inlineText(block.content).trim()) {
        textBlocks += 1;
        contentItems += 1;
      }
    }

    return { topics, sections, contentItems, assets, textBlocks, hasVisual, hasAssessment };
  }, [editor]);

  const insert = useCallback(
    (kind: StoryboardInsertKind, opts?: { level?: number; afterId?: string }): { ok: boolean; warning?: string } => {
      // Anchor to the end of the current structural section (Topic/Section/
      // Content Group) instead of the raw cursor block. The preferred anchor is
      // the workspace's last active block; when it is stale or absent, the
      // fallback is the last block of the current container or the end of the
      // document. This keeps inserts from landing in the middle of authored
      // content after focus has moved to a toolbar item.
      const preferredAnchorId = opts?.afterId && editor.getBlock(opts.afterId) ? opts.afterId : undefined;
      const anchorId = resolveInsertionAnchor(editor.document, preferredAnchorId);
      const cursorBlock = editor.getTextCursorPosition().block;
      const anchorBlock = anchorId ? editor.getBlock(anchorId) ?? cursorBlock : cursorBlock;

      if (kind !== 'heading') {
        const capacity = checkGroupCapacity(anchorBlock.id);
        if (!capacity.ok) return capacity;
      }

      const inserted = editor.insertBlocks(
        [blockForKind(kind, opts?.level) as never],
        anchorBlock,
        'after'
      );
      const first = inserted[0];
      if (first) editor.setTextCursorPosition(first, 'end');
      return { ok: true };
    },
    [editor, checkGroupCapacity]
  );

  // Insert a pre-populated component card (AI Assistance → Insert). Only
  // component-card kinds are supported; others no-op. Returns the new block id,
  // or null with `warning` set when the target Content Group is already at
  // capacity (shares checkGroupCapacity with `insert` — Copilot review finding:
  // this path used to insert unconditionally, bypassing the limit `insert`
  // enforced).
  const insertComponent = useCallback(
    (
      kind: StoryboardInsertKind,
      opts?: { title?: string; data?: Record<string, unknown>; afterId?: string }
    ): { id: string | null; warning?: string } => {
      if (!isComponentKind(kind)) return { id: null };
      const preferredAnchorId = opts?.afterId && editor.getBlock(opts.afterId) ? opts.afterId : undefined;
      const anchorId = resolveInsertionAnchor(editor.document, preferredAnchorId);
      const cursorBlock = editor.getTextCursorPosition().block;
      const anchorBlock = anchorId ? editor.getBlock(anchorId) ?? cursorBlock : cursorBlock;

      const capacity = checkGroupCapacity(anchorBlock.id);
      if (!capacity.ok) return { id: null, warning: capacity.warning };

      const inserted = editor.insertBlocks(
        [makeComponentBlock(kind as ComponentKind, opts) as never],
        anchorBlock,
        'after'
      );
      const first = inserted[0];
      if (first) editor.setTextCursorPosition(first, 'end');
      return { id: first?.id ?? null };
    },
    [editor, checkGroupCapacity]
  );

  const focusBlock = useCallback(
    (blockId: string) => {
      try {
        editor.setTextCursorPosition(blockId, 'start');
      } catch {
        /* block removed — ignore */
      }
      const el = document.querySelector(`[data-id="${blockId}"]`);
      el?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
      if (el instanceof HTMLElement) {
        document.querySelectorAll('.sb-storyboard-focus-target').forEach((node) => node.classList.remove('sb-storyboard-focus-target'));
        el.classList.add('sb-storyboard-focus-target');
        window.setTimeout(() => el.classList.remove('sb-storyboard-focus-target'), 1800);
      }
    },
    [editor]
  );

  // Comments anchor to the Page (H1)/Article (H2) enclosing the cursor, never
  // to a Block/Component — see resolveCommentAnchor.
  const getCommentAnchor = useCallback((): ActiveBlockInfo | null => {
    try {
      const cursorBlockId = editor.getTextCursorPosition().block.id;
      return resolveCommentAnchor(editor.document, cursorBlockId);
    } catch {
      return null;
    }
  }, [editor]);

  useImperativeHandle(
    ref,
    (): StoryboardEditorHandle => ({
      getDocument: () => editor.document as StoryboardDocument,
      setDocument: (doc) => {
        const blocks = (Array.isArray(doc) ? doc : []) as PartialBlock[];
        if (blocks.length) editor.replaceBlocks(editor.document, blocks);
      },
      getHeadings,
      getSummary,
      insert,
      insertComponent,
      getActiveText: () => {
        try {
          return inlineText(editor.getTextCursorPosition().block.content);
        } catch {
          return '';
        }
      },
      replaceActive: (text: string) => {
        try {
          editor.updateBlock(editor.getTextCursorPosition().block, { content: text });
        } catch {
          /* no active block */
        }
      },
      insertAfterActive: (text: string) => {
        try {
          editor.insertBlocks(
            [{ type: 'paragraph', content: text } as never],
            editor.getTextCursorPosition().block,
            'after'
          );
        } catch {
          /* no active block */
        }
      },
      focusBlock,
      getCommentAnchor,
    }),
    [editor, getHeadings, getSummary, insert, insertComponent, focusBlock, getCommentAnchor]
  );

  useEffect(() => {
    if (!onChange) return;
    return editor.onChange(() => onChange(editor.document as StoryboardDocument, getHeadings()));
  }, [editor, onChange, getHeadings]);

  // Catch-all safety net for mutation paths that can't cleanly be gated
  // up front — chiefly BlockNote's own formatting-toolbar block-type dropdown
  // (its H4 option updates the block via BlockNote's internal Select
  // handling, not a click handler this file owns), plus paste and
  // drag-reorder across groups. `insert`/`insertComponent`/the H4 slash item
  // already reject the specific action that would cause an overflow; this
  // reactively flags any group that ends up over capacity by whatever route,
  // so an author is never left with a silently-mismatched document. Only
  // warns when a group newly crosses the limit (tracked by a stable key), not
  // on every keystroke while already-known-overflowing content just sits
  // there (e.g. a legacy/imported doc).
  const warnedGroupsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!onWarning) return;
    return editor.onChange(() => {
      const tree = parseDocToTree(editor.document as unknown[], () => undefined);
      const currentlyOverflowing = new Set<string>();
      for (const topic of tree) {
        for (const section of topic.sections) {
          for (const group of section.groups) {
            if (group.components.length <= MAX_COMPONENTS_PER_BLOCK) continue;
            const key = group.sourceBlockId ?? group.components[0]?.sourceBlockId ?? '';
            if (!key) continue;
            currentlyOverflowing.add(key);
            if (!warnedGroupsRef.current.has(key)) {
              onWarning(
                `"${group.title || 'A Content Group'}" has more than ${MAX_COMPONENTS_PER_BLOCK} component(s) — it will be split into extra blocks on Generate.`
              );
            }
          }
        }
      }
      warnedGroupsRef.current = currentlyOverflowing;
    });
  }, [editor, onWarning]);

  // Report the cursor's block so the Review panel can anchor comments (AC9).
  useEffect(() => {
    if (!onActiveBlock) return;
    return editor.onSelectionChange(() => {
      try {
        const block = editor.getTextCursorPosition().block;
        onActiveBlock({ id: block.id, text: inlineText(block.content), type: block.type });
      } catch {
        onActiveBlock(null);
      }
    });
  }, [editor, onActiveBlock]);

  // Formatting-tab restriction (spec AC4): the block-type dropdown offers only
  // H4 among headings — H1–H3 (structure) come from the "Add Heading" control.
  const isHeadingTitle = (title: string) => /^\s*(toggle\s+)?heading\b/i.test(title);

  const getSlashItems = (query: string): DefaultReactSuggestionItem[] => {
    const defaults = getDefaultReactSlashMenuItems(editor);
    const headingIcon = defaults.find((i) => isHeadingTitle(i.title))?.icon;
    // Keep every non-heading default, then add a single "Heading 4" item.
    const nonHeadings = defaults.filter((i) => !isHeadingTitle(i.title));
    const h4: DefaultReactSuggestionItem = {
      title: 'Heading 4',
      group: 'Headings',
      icon: headingIcon,
      subtext: 'Component-level heading',
      onItemClick: () => {
        const block = editor.getTextCursorPosition().block;
        // Converting a block to H4 starts a NEW generated Text component at
        // that position (parseDocToTree's heading-level-4 branch) — unlike
        // `insert`, this mutates an existing block rather than adding one, so
        // whether it actually increases the group's component count depends
        // on whether that block was previously merged into a sibling
        // paragraph's body. Simulate the conversion and recount with the
        // SAME generator function rather than assuming "already at the
        // limit" always blocks it (a lone paragraph becoming the group's
        // only H4 doesn't change the count at all).
        const simulatedDoc = (editor.document as Array<{ id: string; type: string; props?: unknown }>).map((b) =>
          b.id === block.id ? { ...b, type: 'heading', props: { ...(b.props as object), level: 4 } } : b
        );
        if (componentsInContainer(block.id, simulatedDoc) > MAX_COMPONENTS_PER_BLOCK) {
          onWarning?.(
            MAX_COMPONENTS_PER_BLOCK === 1
              ? 'This Content Group already has a component. Add a new Content Group (H3) for more.'
              : `A Content Group can hold up to ${MAX_COMPONENTS_PER_BLOCK} components. Add a new Content Group (H3) for more.`
          );
          return;
        }
        editor.updateBlock(block, { type: 'heading', props: { level: 4 } } as never);
      },
    };
    const custom: DefaultReactSuggestionItem[] = (
      Object.keys(INSERT_META) as (keyof typeof INSERT_META)[]
    ).map((kind) => ({
      title: INSERT_META[kind].label,
      group: INSERT_META[kind].category,
      onItemClick: () => insert(kind),
    }));
    return filterSuggestionItems([...nonHeadings, h4, ...custom], query);
  };

  // Block-type dropdown in the formatting toolbar: paragraph + lists + H4 only.
  const formattingBlockTypes = () => {
    const defaults = blockTypeSelectItems(editor.dictionary);
    const headingIcon = defaults.find((i) => i.type === 'heading')?.icon;
    const h4 = {
      name: 'Heading 4',
      type: 'heading',
      props: { level: 4 },
      icon: headingIcon ?? (() => null),
      isSelected: (block: { type: string; props?: { level?: number } }) =>
        block.type === 'heading' && block.props?.level === 4,
    };
    return [
      ...defaults.filter((i) => i.type !== 'heading' && !/toggle\s+heading/i.test(i.name)),
      h4,
    ] as typeof defaults;
  };

  // Insert the subscript/superscript toggles into BlockNote's own default
  // toolbar item list (right after Strike, alongside the other basic text
  // styles) rather than replacing it — keeps every other default button
  // (block type, table, file, color, link, comment, etc.) exactly as-is.
  const getToolbarItems = () => {
    const items = getFormattingToolbarItems(formattingBlockTypes());
    const strikeIndex = items.findIndex((el) => el.key === 'strikeStyleButton');
    const scriptButtons = [
      <ScriptStyleButton key="subscriptStyleButton" styleKey="subscript" label="Subscript" Icon={SubscriptIcon} />,
      <ScriptStyleButton key="superscriptStyleButton" styleKey="superscript" label="Superscript" Icon={SuperscriptIcon} />,
    ];
    if (strikeIndex === -1) return [...items, ...scriptButtons];
    return [...items.slice(0, strikeIndex + 1), ...scriptButtons, ...items.slice(strikeIndex + 1)];
  };

  useEffect(() => {
    const applySideMenuLabels = () => {
      document.querySelectorAll('.bn-side-menu').forEach((menu) => {
        const buttons = Array.from(menu.querySelectorAll('button'));
        buttons.forEach((button, index) => {
          const isDragHandle = button.getAttribute('data-test') === 'dragHandle';
          const label = isDragHandle ? 'Open block actions' : index === 0 ? 'Add block' : 'Open block actions';
          button.setAttribute('aria-label', label);
          button.setAttribute('title', label);
        });
      });
    };

    applySideMenuLabels();
    const observer = new MutationObserver(applySideMenuLabels);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <BlockNoteView editor={editor} editable={editable} theme="light" slashMenu={false} formattingToolbar={false}>
      <FormattingToolbarController
        formattingToolbar={() => <FormattingToolbar>{getToolbarItems()}</FormattingToolbar>}
      />
      <SuggestionMenuController
        triggerCharacter="/"
        getItems={async (query) => getSlashItems(query)}
      />
    </BlockNoteView>
  );
}

export const BlockNoteStoryboardEditor = forwardRef(BlockNoteStoryboardEditorImpl);
