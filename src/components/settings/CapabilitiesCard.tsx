import { SparklesIcon } from "@heroicons/react/24/outline";

import { CapabilityStatus } from "../common/CapabilityStatus";
import { SettingRow, SettingsPanel } from "./SettingsPanel";

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
      <dl className="divide-y divide-base-300 text-sm">
        {Object.entries(capabilities).map(([name, enabled]) => (
          <SettingRow label={capabilityLabel(name)} key={name}>
            {typeof enabled === "boolean" ? (
              <CapabilityStatus
                label={enabled ? "Enabled" : "Disabled"}
                state={enabled ? "enabled" : "disabled"}
              />
            ) : (
              <CapabilityStatus state="unsupported" label={String(enabled)} />
            )}
          </SettingRow>
        ))}
      </dl>
    </SettingsPanel>
  );
}
