import type { Story } from "@ladle/react";
import { RuntimeSummary } from "./RuntimeSummary";

export default { title: "Feature / Settings / Runtime Summary" };

export const WithModels: Story = () => (
  <div className="max-w-3xl p-4">
    <RuntimeSummary
      modelCount={2}
      permissionCount={3}
      rateLimitName="Standard"
      models={
        [
          {
            id: "model-1",
            model: "ruxex-reasoner",
            displayName: "Ruxex Reasoner",
            inputModalities: ["text"],
            supportedReasoningEfforts: [],
          },
          {
            id: "model-2",
            model: "ruxex-fast",
            displayName: "Ruxex Fast",
            inputModalities: ["text", "image"],
            supportedReasoningEfforts: [],
          },
        ] as never
      }
    />
  </div>
);
