import type { ConversationViewItem } from "./conversation-model";

export function ActivityItem({ item }: { item: ConversationViewItem }) {
  return (
    <details className="collapse collapse-arrow border border-base-300 bg-base-100">
      <summary className="collapse-title flex items-center gap-2 py-3 text-sm font-medium">
        <span>{item.title}</span>
        <span className="badge badge-ghost badge-sm">{item.type}</span>
      </summary>
      <div className="collapse-content">
        {item.metadata && (
          <dl className="mb-3 grid gap-x-4 gap-y-1 text-xs text-base-content/60 sm:grid-cols-2">
            {Object.entries(item.metadata).map(([key, value]) => (
              <div className="flex min-w-0 gap-2" key={key}>
                <dt className="shrink-0 font-medium">{key}</dt>
                <dd className="truncate" title={value}>{value}</dd>
              </div>
            ))}
          </dl>
        )}
        <p className="whitespace-pre-wrap text-sm text-base-content/80">{item.text || "…"}</p>
      </div>
    </details>
  );
}
