import type { Story } from "@ladle/react";

import { ComposerSettings } from "./ComposerSettings";

export const EmptyModelList: Story = () => (
  <ComposerSettings
    disabled={false}
    effort="medium"
    model=""
    models={[]}
    onEffortChange={() => undefined}
    onModelChange={() => undefined}
  />
);
