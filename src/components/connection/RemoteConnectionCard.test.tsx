// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RemoteConnectionCard } from "./RemoteConnectionCard";

describe("RemoteConnectionCard", () => {
  afterEach(cleanup);

  it("submits a validated remote endpoint with an in-memory token", () => {
    const onConnect = vi.fn();

    render(
      <RemoteConnectionCard
        endpointKind={null}
        isConnecting={false}
        isDisconnecting={false}
        onConnect={onConnect}
        onDisconnect={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Remote WebSocket URL"), {
      target: { value: "wss://example.test/rpc" },
    });
    fireEvent.change(screen.getByLabelText("Authentication token"), {
      target: { value: "memory-only-token" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Connect remote" }));

    expect(onConnect).toHaveBeenCalledWith({
      kind: "websocket",
      url: "wss://example.test/rpc",
      authToken: "memory-only-token",
    });
  });

  it("rejects non-secure non-loopback endpoints before calling the bridge", () => {
    const onConnect = vi.fn();

    render(
      <RemoteConnectionCard
        endpointKind={null}
        isConnecting={false}
        isDisconnecting={false}
        onConnect={onConnect}
        onDisconnect={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Remote WebSocket URL"), {
      target: { value: "ws://remote.example/rpc" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Connect remote" }));

    expect(onConnect).not.toHaveBeenCalled();
    expect(screen.getByText("Use wss:// or a loopback ws:// endpoint.")).toBeTruthy();
  });

  it("offers disconnect for an active remote connection", () => {
    const onDisconnect = vi.fn();

    render(
      <RemoteConnectionCard
        endpointKind="websocket"
        isConnecting={false}
        isDisconnecting={false}
        onConnect={vi.fn()}
        onDisconnect={onDisconnect}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Disconnect remote" }));

    expect(onDisconnect).toHaveBeenCalledOnce();
  });
});
