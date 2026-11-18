import type { Story } from "@ladle/react";

import { PasswordInput } from "./PasswordInput";

export const Default: Story = () => (
  <div className="max-w-md p-4">
    <PasswordInput id="catalog-password" label="Access token" value="example-secret" readOnly />
  </div>
);
