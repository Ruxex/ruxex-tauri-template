import { useTranslation } from "react-i18next";
import { CapabilityStatus } from "@/components/base/common/CapabilityStatus";

type BrowserComputerUseCardProps = {
  config: {
    browser_use?: unknown;
    computer_use?: unknown;
  } | null;
  requirements: {
    allowBrowserAndComputerUse?: boolean | null;
    browserUse?: unknown;
    computerUse?: unknown;
  } | null;
};

export function BrowserComputerUseCard({ config, requirements }: BrowserComputerUseCardProps) {
  const { t } = useTranslation("capabilities");
  const disabledByPolicy = requirements?.allowBrowserAndComputerUse === false;
  const browserAvailable = !disabledByPolicy && requirements?.browserUse != null;
  const computerAvailable = !disabledByPolicy && requirements?.computerUse != null;

  return (
    <article className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body">
        <h2 className="card-title">{t("browserAndComputerUse")}</h2>
        {disabledByPolicy && <p className="text-sm text-warning">{t("disabledByPolicy")}</p>}
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <StatusRow label={t("browserUse")} available={browserAvailable} configured={config?.browser_use != null} />
          <StatusRow
            label={t("computerUse")}
            available={computerAvailable}
            configured={config?.computer_use != null}
          />
        </dl>
      </div>
    </article>
  );
}
function StatusRow({ label, available, configured }: { label: string; available: boolean; configured: boolean }) {
  const { t } = useTranslation("capabilities");
  return (
    <div className="rounded-box bg-base-200 p-3">
      <dt className="font-medium">{label}</dt>
      <dd className="mt-2 flex flex-wrap gap-1.5">
        <CapabilityStatus
          label={available ? t("available") : t("unsupported")}
          state={available ? "enabled" : "unsupported"}
        />
        <CapabilityStatus
          label={configured ? t("configured") : t("notConfigured")}
          state={configured ? "enabled" : "disabled"}
        />
      </dd>
    </div>
  );
}
