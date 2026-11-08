import type { Story } from "@ladle/react";

import { PageContainer } from "./PageContainer";

export const Default: Story = () => (
  <PageContainer>
    <div className="rounded-box bg-base-100 p-5 shadow-sm">
      <h1 className="text-xl font-semibold">Page content</h1>
      <p className="mt-2 text-sm text-base-content/70">
        The container keeps content readable across viewport sizes.
      </p>
    </div>
  </PageContainer>
);
