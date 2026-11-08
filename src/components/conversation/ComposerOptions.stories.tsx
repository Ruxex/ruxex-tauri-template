import type { Story } from "@ladle/react";

import {
  ComposerOptions,
  PermissionMenu,
  SubmissionModeMenu,
} from "./ComposerOptions";

export const Default: Story = () => (
  <div className="flex items-center gap-2">
    <ComposerOptions
      disabled={false}
      goalMode={false}
      onAttach={() => undefined}
      onGoalModeChange={() => undefined}
      onPlanModeChange={() => undefined}
      planMode={false}
    />
    <PermissionMenu
      disabled={false}
      mode="ask"
      onModeChange={() => undefined}
    />
    <SubmissionModeMenu
      activeTurnId={null}
      disabled={false}
      mode="send"
      onModeChange={() => undefined}
    />
  </div>
);

export const ActiveModes: Story = () => (
  <div className="flex items-center gap-2">
    <ComposerOptions
      disabled={false}
      goalMode
      onAttach={() => undefined}
      onGoalModeChange={() => undefined}
      onPlanModeChange={() => undefined}
      planMode
    />
    <PermissionMenu
      disabled={false}
      mode="full-access"
      onModeChange={() => undefined}
    />
    <SubmissionModeMenu
      activeTurnId="turn-catalog"
      disabled={false}
      mode="steer"
      onModeChange={() => undefined}
    />
  </div>
);
