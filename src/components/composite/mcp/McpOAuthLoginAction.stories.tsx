import type { Story } from "@ladle/react";
import { McpOAuthLoginAction } from "./McpOAuthLoginAction";

export const NotAvailable: Story = () => (
  <div className="flex items-center gap-3 p-4 text-sm text-base-content/70">
    <span>Authentication action hidden until the server is available.</span>
    <McpOAuthLoginAction name="catalog-server" />
  </div>
);
