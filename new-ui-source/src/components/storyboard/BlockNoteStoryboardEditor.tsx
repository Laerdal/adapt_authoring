// BlockNote implementation of the storyboard editor.
//
// The ONLY files that know about BlockNote are this one, schema.ts and
// blocks/*. Everything else depends on the engine-agnostic
// `StoryboardEditorHandle` from `@/types/storyboard`.

import { forwardRef, useCallback, useEffect, useImperativeHandle } from 'react';
import { filterSuggestionItems, type PartialBlock } from '@blocknote/core';
import { BlockNoteView } from '@blocknote/mantine';
import {
  blockTypeSelectItems,
  FormattingToolbar,
  FormattingToolbarController,
  getDefaultReactSlashMenuItems,
  SuggestionMenuController,
  useCreateBlockNote,
  type DefaultReactSuggestionItem,
} from '@blocknote/react';

import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';

import {
  adaptTypeForLevel,
  defaultAssessmentData,
  INSERT_META,
  isAssessmentKind,
  type PlaceholderCategory,
  type StoryboardDocument,
  type StoryboardEditorHandle,
  type StoryboardEditorProps,
  type StoryboardHeading,
  type StoryboardInsertKind,
  type StoryboardSummary,
} from '@/types/storyboard';
import { storyboardSchema } from './schema';
import { makeComponentBlock, isComponentKind, type ComponentKind } from './blocks/componentBlock';

// "Add Content" kinds that map to the rich component card (sbComponent).
const COMPONENT_CARD_KINDS = new Set<StoryboardInsertKind>([
  'text',
  'groupedContent',
  'image',
  'video',
  'audio',
  'h5p',
  'laerdalForm',
  'assessmentResult',
]);

const DEFAULT_CONTENT: PartialBlock[] = [
  { type: 'heading', props: { level: 1 }, content: 'New Page Title' },
  { type: 'heading', props: { level: 2 }, content: 'New Section Title' },
  { type: 'paragraph', content: '' },
];

const ASSET_TYPES = new Set(['image', 'video', 'audio']);

function inlineText(content: unknown): string {
  if (!Array.isArray(content)) return '';
  return content
    .map((node) =>
      node && typeof node === 'object' && typeof (node as { text?: unknown }).text === 'string'
        ? (node as { text: string }).text
        : ''
    )
    .join('');
}

// Neutral insert kind → a concrete BlockNote block. Returns a loose shape; the
// call site casts to the editor's block type.
//   heading                     → heading block
//   text/grouped/image/…/form   → rich component card (sbComponent, AC3)
//   mcq/gmcq/…                   → assessment card (sbAssessment, AC5)
//   hotgraphic/…/instruction    → metadata placeholder (sbPlaceholder, AC6)
function blockForKind(kind: StoryboardInsertKind, level = 1): Record<string, unknown> {
  if (kind === 'heading') return { type: 'heading', props: { level }, content: 'New heading' };
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
  { initialDocument, editable = true, onChange, onActiveBlock }: StoryboardEditorProps,
  ref: React.Ref<StoryboardEditorHandle>
) {
  const editor = useCreateBlockNote({
    schema: storyboardSchema,
    initialContent:
      Array.isArray(initialDocument) && initialDocument.length
        ? (initialDocument as PartialBlock[])
        : DEFAULT_CONTENT,
  });

  const getHeadings = useCallback((): StoryboardHeading[] => {
    return editor.document
      .filter((block) => block.type === 'heading')
      .map((block) => {
        const level = Number((block.props as { level?: number }).level ?? 1);
        return {
          id: block.id,
          level,
          text: inlineText(block.content),
          adaptType: adaptTypeForLevel(level),
        };
      });
  }, [editor]);

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
    (kind: StoryboardInsertKind, opts?: { level?: number }) => {
      const ref = editor.getTextCursorPosition().block;
      const inserted = editor.insertBlocks(
        [blockForKind(kind, opts?.level) as never],
        ref,
        'after'
      );
      const first = inserted[0];
      if (first) editor.setTextCursorPosition(first, 'end');
    },
    [editor]
  );

  // Insert a pre-populated component card (AI Assistance → Insert). Only
  // component-card kinds are supported; others no-op. Returns the new block id.
  const insertComponent = useCallback(
    (kind: StoryboardInsertKind, opts?: { title?: string; data?: Record<string, unknown> }): string | null => {
      if (!isComponentKind(kind)) return null;
      const ref = editor.getTextCursorPosition().block;
      const inserted = editor.insertBlocks(
        [makeComponentBlock(kind as ComponentKind, opts) as never],
        ref,
        'after'
      );
      const first = inserted[0];
      if (first) editor.setTextCursorPosition(first, 'end');
      return first?.id ?? null;
    },
    [editor]
  );

  const focusBlock = useCallback(
    (blockId: string) => {
      try {
        editor.setTextCursorPosition(blockId, 'start');
      } catch {
        /* block removed — ignore */
      }
      document.querySelector(`[data-id="${blockId}"]`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    },
    [editor]
  );

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
    }),
    [editor, getHeadings, getSummary, insert, insertComponent, focusBlock]
  );

  useEffect(() => {
    if (!onChange) return;
    return editor.onChange(() => onChange(editor.document as StoryboardDocument, getHeadings()));
  }, [editor, onChange, getHeadings]);

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

  return (
    <BlockNoteView editor={editor} editable={editable} theme="light" slashMenu={false} formattingToolbar={false}>
      <FormattingToolbarController
        formattingToolbar={() => <FormattingToolbar blockTypeSelectItems={formattingBlockTypes()} />}
      />
      <SuggestionMenuController
        triggerCharacter="/"
        getItems={async (query) => getSlashItems(query)}
      />
    </BlockNoteView>
  );
}

export const BlockNoteStoryboardEditor = forwardRef(BlockNoteStoryboardEditorImpl);
