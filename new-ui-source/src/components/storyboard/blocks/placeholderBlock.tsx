// Custom BlockNote block: storyboard content placeholder (spec AC5/AC6).
//
// One block type covers every non-native content kind — grouped content,
// media (H5P), survey (Laerdal Form), assessment (MCQ/GMCQ/…), interactive
// placeholders (Hot Graphic/Grid/Action Plan) and instructions. It captures
// only the metadata the course generator needs (label + category +
// `adaptComponent`); detailed configuration is deferred to the Page Editor.

import { createReactBlockSpec } from '@blocknote/react';
import type { PlaceholderCategory } from '@/types/storyboard';

const CATEGORY_STYLE: Record<PlaceholderCategory, { tag: string; className: string }> = {
  group: { tag: 'Group', className: 'border-[color:var(--muted-foreground)]/40 bg-muted/40' },
  media: { tag: 'Media', className: 'border-primary/40 bg-primary/5' },
  survey: { tag: 'Survey', className: 'border-samaritan/40 bg-samaritan/5' },
  assessment: { tag: 'Assessment', className: 'border-primary/50 bg-primary/5' },
  interactive: { tag: 'Interactive', className: 'border-primary/50 bg-primary/5' },
  instruction: { tag: 'Instruction', className: 'border-samaritan/40 bg-samaritan/5' },
};

export const placeholderBlock = createReactBlockSpec(
  {
    type: 'sbPlaceholder',
    propSchema: {
      label: { default: 'Content' },
      category: {
        default: 'group',
        values: ['group', 'media', 'survey', 'assessment', 'interactive', 'instruction'],
      },
      title: { default: '' },
      // Adapt component this generates into (AC11) — kept on the block so the
      // generator never has to map kind → component itself.
      adaptComponent: { default: 'block' },
    },
    content: 'none',
  },
  {
    render: ({ block, editor }) => {
      const category = block.props.category as PlaceholderCategory;
      const style = CATEGORY_STYLE[category] ?? CATEGORY_STYLE.group;
      const label = block.props.label as string;

      const setTitle = (title: string) => editor.updateBlock(block, { props: { title } });

      return (
        <div className={`my-2 rounded-md border border-dashed p-3 ${style.className}`} contentEditable={false}>
          <div className="flex items-center gap-2">
            <span className="rounded bg-foreground/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-background">
              {style.tag}
            </span>
            <span className="text-sm font-medium text-foreground">{label}</span>
          </div>
          <input
            value={block.props.title as string}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={`${label} title…`}
            className="mt-2 w-full border-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Placeholder → <code>{block.props.adaptComponent as string}</code>. Configure in the Page Editor.
          </p>
        </div>
      );
    },
  }
);
