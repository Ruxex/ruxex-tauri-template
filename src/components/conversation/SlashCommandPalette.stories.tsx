import type { Story } from "@ladle/react";

import type { v2 } from "../../protocol";
import { CatalogSurface } from "../../../.ladle/support/catalog-providers";
import { SlashCommandPalette } from "./SlashCommandPalette";

const skills: v2.SkillMetadata[] = [
  {
    name: "review",
    description: "Review the current changes for correctness and regressions.",
    path: "/workspace/.agents/skills/review",
    scope: "repo",
    enabled: true,
    pluginId: null,
  },
  {
    name: "release-notes",
    description: "Summarize the user-facing changes in this workspace.",
    path: "/workspace/.agents/skills/release-notes",
    scope: "user",
    enabled: true,
    pluginId: null,
  },
];

export const Enabled: Story = () => (
  <CatalogSurface>
    <SlashCommandPalette
      disabled={false}
      onSelect={() => undefined}
      onSelectSkill={() => undefined}
      skills={skills}
    />
  </CatalogSurface>
);

export const Disabled: Story = () => (
  <CatalogSurface>
    <SlashCommandPalette
      disabled
      onSelect={() => undefined}
      onSelectSkill={() => undefined}
      skills={skills}
    />
  </CatalogSurface>
);

export const Filtered: Story = () => (
  <CatalogSurface>
    <SlashCommandPalette
      disabled={false}
      onSelect={() => undefined}
      onSelectSkill={() => undefined}
      query="review"
      skills={skills}
    />
  </CatalogSurface>
);

export const Loading: Story = () => (
  <CatalogSurface>
    <SlashCommandPalette
      disabled={false}
      onSelect={() => undefined}
      skillsLoading
    />
  </CatalogSurface>
);

export const ErrorState: Story = () => (
  <CatalogSurface>
    <SlashCommandPalette
      disabled={false}
      onSelect={() => undefined}
      skillsError="Unable to load skills."
    />
  </CatalogSurface>
);

export const Empty: Story = () => (
  <CatalogSurface>
    <SlashCommandPalette
      disabled={false}
      onSelect={() => undefined}
      skills={[]}
    />
  </CatalogSurface>
);
