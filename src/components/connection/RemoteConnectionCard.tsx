import { useState, type FormEvent } from "react";

import type { AppServerEndpoint } from "../../app-server/api";
import { validateRemoteEndpoint } from "../../platform/platform-model";

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
    <section className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body">
        <div>
          <h2 className="card-title">Remote App Server</h2>
          <p className="text-sm text-base-content/70">
            Tokens are kept in memory and sent only when connecting.
          </p>
        </div>
        <form className="grid gap-3" onSubmit={submit}>
          <label className="form-control">
            <span className="label-text">Remote WebSocket URL</span>
            <input
              aria-label="Remote WebSocket URL"
              className="input input-bordered input-sm mt-1"
              onChange={(event) => setUrl(event.target.value)}
              placeholder="wss://server.example/rpc"
              value={url}
            />
          </label>
          <label className="form-control">
            <span className="label-text">Authentication token</span>
            <input
              aria-label="Authentication token"
              autoComplete="off"
              className="input input-bordered input-sm mt-1"
              onChange={(event) => setAuthToken(event.target.value)}
              type="password"
              value={authToken}
            />
          </label>
          {(validationError ?? error) !== null && (validationError ?? error) !== undefined && (
            <p className="text-sm text-error">
              {validationError ?? String(error)}
            </p>
          )}
          <div className="flex justify-end gap-2">
            {endpointKind === "websocket" && (
              <button
                className="btn btn-sm btn-ghost"
                disabled={isDisconnecting}
                onClick={onDisconnect}
                type="button"
              >
                {isDisconnecting ? "Disconnecting…" : "Disconnect remote"}
              </button>
            )}
            <button
              className="btn btn-sm btn-primary"
              disabled={isConnecting}
              type="submit"
            >
              {isConnecting ? "Connecting…" : "Connect remote"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
