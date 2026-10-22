import { useState, type FormEvent } from "react";
import {
  LinkIcon,
  PowerIcon,
  ServerStackIcon,
} from "@heroicons/react/24/outline";

import type { AppServerEndpoint } from "../../app-server/api";
import { formatErrorMessage } from "../../app/error-message";
import { validateRemoteEndpoint } from "../../platform/platform-model";
import { SettingsPanel } from "../settings/SettingsCards";

type RemoteConnectionCardProps = {
  endpointKind: "local" | "websocket" | null | undefined;
  isConnecting: boolean;
  isDisconnecting: boolean;
  error?: unknown;
  onConnect: (endpoint: AppServerEndpoint) => void;
  onDisconnect: () => void;
};

export function RemoteConnectionCard({
  endpointKind,
  isConnecting,
  isDisconnecting,
  error,
  onConnect,
  onDisconnect,
}: RemoteConnectionCardProps) {
  const [url, setUrl] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const endpoint = validateRemoteEndpoint(url.trim());
    if (!endpoint) {
      setValidationError("Use wss:// or a loopback ws:// endpoint.");
      return;
    }
    setValidationError(null);
    onConnect({
      kind: "websocket",
      url: endpoint.url,
      authToken: authToken.trim() || undefined,
    });
  }

  return (
    <SettingsPanel
      icon={ServerStackIcon}
      title="Remote App Server"
      description="Tokens are kept in memory and sent only when connecting."
    >
      <form className="divide-y divide-base-300 text-sm" onSubmit={submit}>
        <label className="grid grid-cols-[minmax(0,1fr)_minmax(12rem,40%)] items-center gap-4 px-5 py-3.5 max-sm:grid-cols-1 max-sm:items-start">
          <span className="label-text">Remote WebSocket URL</span>
          <input
            aria-label="Remote WebSocket URL"
            className="input input-bordered input-sm w-full max-w-sm justify-self-end max-sm:max-w-none"
            onChange={(event) => setUrl(event.target.value)}
            placeholder="wss://server.example/rpc"
            value={url}
          />
        </label>
        <label className="grid grid-cols-[minmax(0,1fr)_minmax(12rem,40%)] items-center gap-4 px-5 py-3.5 max-sm:grid-cols-1 max-sm:items-start">
          <span className="label-text">Authentication token</span>
          <input
            aria-label="Authentication token"
            autoComplete="off"
            className="input input-bordered input-sm w-full max-w-sm justify-self-end max-sm:max-w-none"
            onChange={(event) => setAuthToken(event.target.value)}
            type="password"
            value={authToken}
          />
        </label>
        {(validationError ?? error) !== null &&
          (validationError ?? error) !== undefined && (
            <p className="px-5 py-3 text-error">
              {validationError ?? formatErrorMessage(error)}
            </p>
          )}
        <div className="flex justify-end gap-2 px-5 py-4">
          {endpointKind === "websocket" && (
            <button
              className="btn btn-sm btn-ghost"
              disabled={isDisconnecting}
              onClick={onDisconnect}
              type="button"
            >
              <PowerIcon aria-hidden="true" className="size-4" />
              {isDisconnecting ? "Disconnecting…" : "Disconnect remote"}
            </button>
          )}
          <button
            className="btn btn-sm btn-primary"
            disabled={isConnecting}
            type="submit"
          >
            <LinkIcon aria-hidden="true" className="size-4" />
            {isConnecting ? "Connecting…" : "Connect remote"}
          </button>
        </div>
      </form>
    </SettingsPanel>
  );
}
