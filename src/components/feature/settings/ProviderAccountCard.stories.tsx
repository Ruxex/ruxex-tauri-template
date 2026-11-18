import type { Story } from "@ladle/react";
import { ProviderAccountCard } from "./ProviderAccountCard";

export const Authenticated: Story = () => (
  <div className="max-w-3xl p-4">
    <ProviderAccountCard
      provider="Example Provider"
      authStatus="authenticated"
      account="catalog@example.com"
      dataDirectory="~/.ruxex"
    />
  </div>
);
