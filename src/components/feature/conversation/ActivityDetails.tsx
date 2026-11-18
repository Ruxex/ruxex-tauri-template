import { useTranslation } from "react-i18next";
import { type ArtifactPreviewData, openBrowserWindow } from "@/platform/native";
import { ArtifactPreview } from "./ArtifactPreview";
import { CommandExecutionView } from "./CommandExecutionView";
import type { ConversationViewItem } from "./conversation-model";
import { ImageView } from "./ImageView";
import { MarkdownContent } from "./MarkdownContent";

const previewableArtifactFormats = new Set(["xlsx", "docx", "pptx", "pdf"]);
const hiddenActivityMetadata = new Set(["command", "cwd", "status", "exitCode"]);

type ActivityDetailsProps = {
  item: ConversationViewItem;
  loadArtifactPreview?: (path: string) => Promise<ArtifactPreviewData>;
};

export function ActivityDetails({ item, loadArtifactPreview }: ActivityDetailsProps) {
  const { t } = useTranslation("conversation");

  const isCommandExecution = item.type === "commandExecution";
  const command = isCommandExecution ? item.metadata?.command : undefined;
  const metadataEntries = Object.entries(item.metadata ?? {}).filter(([key]) => !hiddenActivityMetadata.has(key));
  const metadataLabel = (key: string) => {
    switch (key) {
      case "agents":
        return t("metadataLabels.agents");
      case "files":
        return t("metadataLabels.files");
      case "namespace":
        return t("metadataLabels.namespace");
      case "server":
        return t("metadataLabels.server");
      case "success":
        return t("metadataLabels.success");
      case "tool":
        return t("metadataLabels.tool");
      default:
        return key;
    }
  };

  return (
    <>
      {item.imagePath && <ImageView path={item.imagePath} />}
      {item.imageUrls?.map((url) => (
        <ImageView key={url} url={url} />
      ))}
      {item.browserUrl && (
        <button
          aria-label={t("openInBrowser")}
          className="btn btn-sm btn-outline mb-3"
          onClick={() => void openBrowserWindow(item.browserUrl ?? "")}
          type="button"
        >
          {t("openInBrowser")}
        </button>
      )}
      {item.artifactPath && item.artifactFormat && previewableArtifactFormats.has(item.artifactFormat) && (
        <ArtifactPreview loadPreview={loadArtifactPreview} path={item.artifactPath} />
      )}
      {isCommandExecution && command && <CommandExecutionView command={command} result={item.text} />}
      {metadataEntries.length > 0 && (
        <dl className="mb-3 grid gap-x-4 gap-y-1 text-xs text-base-content/60 sm:grid-cols-2">
          {metadataEntries.map(([key, value]) => (
            <div className="flex min-w-0 gap-2" key={key}>
              <dt className="shrink-0 font-medium">{metadataLabel(key)}</dt>
              <dd className="truncate" title={value}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {!(isCommandExecution && command) && <MarkdownContent text={item.text || "…"} />}
    </>
  );
}
