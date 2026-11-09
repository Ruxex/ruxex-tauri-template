import type { ReactNode } from "react";

export type StoryVariant = {
  content: ReactNode;
  label: string;
};

type StoryVariantListProps = {
  variants: readonly StoryVariant[];
};

export function StoryVariantList({ variants }: StoryVariantListProps) {
  return (
    <div
      className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3"
      data-testid="story-variant-list"
    >
      {variants.map(({ content, label }) => (
        <section
          aria-label={label}
          className="min-w-0 rounded-box border border-base-300 bg-base-100 p-3 shadow-sm"
          key={label}
        >
          <h2 className="mb-3 text-sm font-semibold text-base-content">
            {label}
          </h2>
          <div className="min-w-0">{content}</div>
        </section>
      ))}
    </div>
  );
}
