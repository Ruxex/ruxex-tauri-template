import type { Story } from "@ladle/react";

import { ComposerSettings } from "./ComposerSettings";

export const EmptyModelList: Story = () => (
  <ComposerSettings
    disabled={false}
    effort=""
    model=""
    models={[]}
    onEffortChange={() => undefined}
    onModelChange={() => undefined}
  />
);

export const LoadedModelList: Story = () => (
  <ComposerSettings
    disabled={false}
    effort="high"
    model="gpt-5-codex"
    models={[
      {
        id: "model-codex",
        model: "gpt-5-codex",
        displayName: "GPT-5 Codex",
        description: "Strong coding and reasoning model",
        upgrade: null,
        upgradeInfo: null,
        availabilityNux: null,
        modelSpecialty: "coding",
        hidden: false,
        supportedReasoningEfforts: [
          { reasoningEffort: "medium", description: "Balanced reasoning" },
          { reasoningEffort: "high", description: "Deeper reasoning" },
        ],
        defaultReasoningEffort: "medium",
        inputModalities: ["text"],
        multiAgentVersion: null,
        additionalSpeedTiers: [],
        serviceTiers: [],
        defaultServiceTier: null,
        availableAccessPrograms: null,
        isDefault: true,
      },
      {
        id: "model-fast",
        model: "gpt-5-mini",
        displayName: "GPT-5 mini",
        description: "Fast model for everyday tasks",
        upgrade: null,
        upgradeInfo: null,
        availabilityNux: null,
        modelSpecialty: null,
        hidden: false,
        supportedReasoningEfforts: [
          { reasoningEffort: "medium", description: "Balanced reasoning" },
        ],
        defaultReasoningEffort: "medium",
        inputModalities: ["text"],
        multiAgentVersion: null,
        additionalSpeedTiers: [],
        serviceTiers: [],
        defaultServiceTier: null,
        availableAccessPrograms: null,
        isDefault: false,
      },
    ]}
    onEffortChange={() => undefined}
    onModelChange={() => undefined}
  />
);
