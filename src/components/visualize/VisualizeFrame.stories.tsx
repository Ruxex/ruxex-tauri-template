import type { Story } from "@ladle/react";

import { VisualizeFrame } from "./VisualizeFrame";

export const InlineHtml: Story = () => (
  <VisualizeFrame
    loadHtml={async () =>
      "<main style='padding:2rem'><h1>Local visualization</h1><p>Sandboxed HTML preview</p></main>"}
    reference={{ path: "/workspace/visualization.html", mode: "regular" }}
  />
);
