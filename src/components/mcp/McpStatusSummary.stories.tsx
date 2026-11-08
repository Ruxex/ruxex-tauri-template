import type { Story } from "@ladle/react";
import type { ReactNode } from "react";

import { McpStatusSummary } from "./McpStatusSummary";

function Surface({ children }: { children: ReactNode }) {
  return <div className="max-w-2xl bg-base-100 p-6">{children}</div>;
}

export const ConnectedWithOAuth: Story = () => (
  <Surface>
    <McpStatusSummary authStatus="oAuth" runtimeStatus="connected" />
  </Surface>
);

export const StartingWithoutAuth: Story = () => (
  <Surface>
    <McpStatusSummary authStatus="notLoggedIn" runtimeStatus="starting" />
  </Surface>
);

export const AuthenticationRequired: Story = () => (
  <Surface>
    <McpStatusSummary
      authStatus="notLoggedIn"
      runtimeStatus="authenticationRequired"
    />
  </Surface>
);

export const FailedWithUnknownStatus: Story = () => (
  <Surface>
    <McpStatusSummary authStatus="unknown" runtimeStatus="failed" />
  </Surface>
);

export const StatusUnavailable: Story = () => (
  <Surface>
    <McpStatusSummary authStatus="unknown" runtimeStatus={null} />
  </Surface>
);
