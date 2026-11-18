import { i18n } from "@/app/i18n";
import { useTranslation } from "react-i18next";
import { SparklesIcon } from "@heroicons/react/24/outline";

import { CapabilityStatus } from "@/components/base/common/CapabilityStatus";
import { SettingsPanel } from "./SettingsPanel";

const CAPABILITY_LABELS: Record<string, string> = {
  apiKeyModelDiscovery: "apiKeyModelDiscovery",
  commandAuth: "commandAuthorization",
  externalWebAccess: "externalWebAccess",
  historyNotes: "historyNotes",
  interactiveLogin: "interactiveLogin",
  modelListing: "modelListing",
  namespaceTools: "namespaceTools",
  remoteCompaction: "remoteCompaction",
  standaloneWebSearch: "standaloneWebSearch",
  streaming: "streaming",
  usage: "usageReporting",
  webSearch: "webSearch",
  websocket: "webSocket",
};

function capabilityLabel(name: string): string {
  return (
    (CAPABILITY_LABELS[name] ? i18n.t(`settings:${CAPABILITY_LABELS[name]}`) : undefined) ??
    name
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replaceAll("_", " ")
      .replace(/^./, (character) => character.toUpperCase())
  );
}

export function CapabilitiesCard({ capabilities }: { capabilities: Record<string, boolean | string> }) {
  const { t } = useTranslation("settings");
  return (
    <SettingsPanel icon={SparklesIcon} title={t("settings:capabilities")}>
      <dl className="grid grid-cols-1 gap-px bg-base-300 text-sm sm:grid-cols-2 xl:grid-cols-3">
        {Object.entries(capabilities).map(([name, enabled]) => (
          <div
            className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 bg-base-100 px-5 py-3.5"
            key={name}
          >
            <dt className="min-w-0 leading-snug">{capabilityLabel(name)}</dt>
            <dd className="justify-self-end text-right">
              {enabled === true ? (
                <CapabilityStatus label={t("settings:enabled")} state="enabled" />
              ) : (
                <CapabilityStatus
                  state="unsupported"
                  label={typeof enabled === "boolean" ? t("settings:unsupported") : String(enabled)}
                />
              )}
            </dd>
          </div>
        ))}
      </dl>
    </SettingsPanel>
  );
}
