import { SparklesIcon } from "@heroicons/react/24/outline";

import { CapabilityStatus } from "../common/CapabilityStatus";
import { SettingsPanel } from "./SettingsPanel";

const CAPABILITY_LABELS: Record<string, string> = {
  apiKeyModelDiscovery: "API key model discovery",
  commandAuth: "Command authorization",
  externalWebAccess: "External web access",
  historyNotes: "History notes",
  interactiveLogin: "Interactive login",
  modelListing: "Model listing",
  namespaceTools: "Namespace tools",
  remoteCompaction: "Remote compaction",
  standaloneWebSearch: "Standalone web search",
  streaming: "Streaming",
  usage: "Usage reporting",
  webSearch: "Web search",
  websocket: "WebSocket",
};

function capabilityLabel(name: string): string {
  return (
    CAPABILITY_LABELS[name] ??
    name
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replaceAll("_", " ")
      .replace(/^./, (character) => character.toUpperCase())
  );
}

export function CapabilitiesCard({
  capabilities,
}: {
  capabilities: Record<string, boolean | string>;
}) {
  return (
    <SettingsPanel icon={SparklesIcon} title="Capabilities">
      <dl className="grid grid-cols-1 gap-px bg-base-300 text-sm sm:grid-cols-2 xl:grid-cols-3">
        {Object.entries(capabilities).map(([name, enabled]) => (
          <div
            className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 bg-base-100 px-5 py-3.5"
            key={name}
          >
            <dt className="min-w-0 leading-snug">{capabilityLabel(name)}</dt>
            <dd className="justify-self-end text-right">
              {typeof enabled === "boolean" ? (
                <CapabilityStatus
                  label={enabled ? "Enabled" : "Disabled"}
                  state={enabled ? "enabled" : "disabled"}
                />
              ) : (
                <CapabilityStatus state="unsupported" label={String(enabled)} />
              )}
            </dd>
          </div>
        ))}
      </dl>
    </SettingsPanel>
  );
}
