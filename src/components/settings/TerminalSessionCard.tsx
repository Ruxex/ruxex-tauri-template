import { CommandLineIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  DEFAULT_TERMINAL_SESSION_TIMEOUT,
  readTerminalSessionTimeout,
  setTerminalSessionIdleTimeout,
  terminalSessionTimeoutMs,
  updateTerminalSessionTimeout,
  type TerminalSessionTimeout,
} from "../../platform/terminal";
import { FormFieldRow } from "../common/FormFieldRow";
import { SettingsPanel } from "./SettingsPanel";

export function TerminalSessionCard() {
  const { t } = useTranslation("settings");
  const [timeout, setTimeout] = useState<TerminalSessionTimeout>(
    DEFAULT_TERMINAL_SESSION_TIMEOUT,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<"load" | "save" | null>(null);

  useEffect(() => {
    let active = true;
    void readTerminalSessionTimeout()
      .then((value) => {
        if (!active) return;
        setTimeout(value);
        setTerminalSessionIdleTimeout(terminalSessionTimeoutMs(value));
      })
      .catch(() => {
        if (active) setError("load");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleTimeoutChange(value: TerminalSessionTimeout) {
    setIsSaving(true);
    setError(null);
    try {
      const saved = await updateTerminalSessionTimeout(value);
      setTimeout(saved);
      setTerminalSessionIdleTimeout(terminalSessionTimeoutMs(saved));
    } catch {
      setError("save");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SettingsPanel icon={CommandLineIcon} title={t("settings:terminal")}>
      <div className="text-sm">
        <FormFieldRow
          controlId="settings-terminal-session-timeout"
          label={t("settings:terminalSessionTimeout")}
        >
          <select
            aria-label={t("settings:terminalSessionTimeout")}
            className="select select-bordered select-sm w-full max-w-sm justify-self-end max-sm:max-w-none"
            disabled={isLoading || isSaving}
            id="settings-terminal-session-timeout"
            onChange={(event) =>
              void handleTimeoutChange(
                event.target.value as TerminalSessionTimeout,
              )
            }
            value={timeout}
          >
            <option value="1h">{t("settings:terminalTimeouts.1h")}</option>
            <option value="6h">{t("settings:terminalTimeouts.6h")}</option>
            <option value="24h">{t("settings:terminalTimeouts.24h")}</option>
            <option value="72h">{t("settings:terminalTimeouts.72h")}</option>
            <option value="never">
              {t("settings:terminalTimeouts.never")}
            </option>
          </select>
        </FormFieldRow>
        {error && (
          <p
            className="px-5 pb-3 text-xs text-error"
            role={error === "load" ? "status" : "alert"}
          >
            {t(
              error === "load"
                ? "settings:terminalTimeoutLoadError"
                : "settings:terminalTimeoutSaveError",
            )}
          </p>
        )}
      </div>
    </SettingsPanel>
  );
}
