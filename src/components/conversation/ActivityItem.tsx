import type { ConversationViewItem } from "./conversation-model";
import { ImageView } from "./ImageView";
import { MarkdownContent } from "./MarkdownContent";
import { openBrowserWindow } from "../../platform/native";

export function ActivityItem({ item }: { item: ConversationViewItem }) {
  return (
    <details className="collapse collapse-arrow border border-base-300 bg-base-100">
      <summary className="collapse-title flex items-center gap-2 py-3 text-sm font-medium">
        <span>{item.title}</span>
        <span className="badge badge-ghost badge-sm">{item.type}</span>
      </summary>
      <div className="collapse-content">
        {item.imagePath && <ImageView path={item.imagePath} />}
        {item.imageUrls?.map((url) => (
          <ImageView key={url} url={url} />
        ))}
        {item.browserUrl && (
          <button
            className="btn btn-sm btn-outline mb-3"
            onClick={() => void openBrowserWindow(item.browserUrl ?? "")}
            type="button"
          >
            Open in browser
          </button>
        )}
        {item.metadata && (
          <dl className="mb-3 grid gap-x-4 gap-y-1 text-xs text-base-content/60 sm:grid-cols-2">
            {Object.entries(item.metadata).map(([key, value]) => (
              <div className="flex min-w-0 gap-2" key={key}>
                <dt className="shrink-0 font-medium">{key}</dt>
                <dd className="truncate" title={value}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        )}
        <MarkdownContent text={item.text || "…"} />
      </div>
    </details>
  );
}
