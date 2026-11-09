import type { ConversationViewItem } from "./conversation-model";
import { CommandExecutionView } from "./CommandExecutionView";
import { ArtifactPreview } from "./ArtifactPreview";
import { ImageView } from "./ImageView";
import { MarkdownContent } from "./MarkdownContent";
import {
  openBrowserWindow,
  type ArtifactPreviewData,
} from "../../platform/native";

const previewableArtifactFormats = new Set(["xlsx", "docx", "pptx", "pdf"]);
const hiddenActivityMetadata = new Set([
  "command",
  "cwd",
  "status",
  "exitCode",
]);

type ActivityDetailsProps = {
  item: ConversationViewItem;
  loadArtifactPreview?: (path: string) => Promise<ArtifactPreviewData>;
};

export function ActivityDetails({
  item,
  loadArtifactPreview,
}: ActivityDetailsProps) {
  const isCommandExecution = item.type === "commandExecution";
  const command = isCommandExecution ? item.metadata?.command : undefined;
  const metadataEntries = Object.entries(item.metadata ?? {}).filter(
    ([key]) => !hiddenActivityMetadata.has(key),
  );

  return (
    <>
      {item.imagePath && <ImageView path={item.imagePath} />}
      {item.imageUrls?.map((url) => (
        <ImageView key={url} url={url} />
      ))}
      {item.browserUrl && (
        <button
          aria-label="Open in browser"
          className="btn btn-sm btn-outline mb-3"
          onClick={() => void openBrowserWindow(item.browserUrl ?? "")}
          type="button"
        >
          Open in browser
        </button>
      )}
      {item.artifactPath &&
        item.artifactFormat &&
        previewableArtifactFormats.has(item.artifactFormat) && (
          <ArtifactPreview
            loadPreview={loadArtifactPreview}
            path={item.artifactPath}
          />
        )}
      {isCommandExecution && command && (
        <CommandExecutionView command={command} result={item.text} />
      )}
      {metadataEntries.length > 0 && (
        <dl className="mb-3 grid gap-x-4 gap-y-1 text-xs text-base-content/60 sm:grid-cols-2">
          {metadataEntries.map(([key, value]) => (
            <div className="flex min-w-0 gap-2" key={key}>
              <dt className="shrink-0 font-medium">{key}</dt>
              <dd className="truncate" title={value}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {!(isCommandExecution && command) && (
        <MarkdownContent text={item.text || "…"} />
      )}
    </>
  );
}
