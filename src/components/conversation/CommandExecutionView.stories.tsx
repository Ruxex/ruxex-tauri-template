import type { Story } from "@ladle/react";

import { StoryVariantList } from "../../../.ladle/support/StoryVariantList";

import { CommandExecutionView } from "./CommandExecutionView";

export const States: Story = () => (
  <StoryVariantList
    variants={[
      {
        content: (
          <CommandExecutionView
            command="pnpm check"
            result={"All checks passed.\nNo changes required."}
          />
        ),
        label: "Completed",
      },
      {
        content: (
          <CommandExecutionView
            command="pnpm test --watch"
            result={"Running test suite…\nWaiting for file changes."}
          />
        ),
        label: "Running",
      },
      {
        content: (
          <CommandExecutionView command="git status --short" result="" />
        ),
        label: "Empty output",
      },
      {
        content: (
          <CommandExecutionView
            command="pnpm test --runInBand"
            result="Test suite failed with one assertion."
          />
        ),
        label: "Failed result",
      },
    ]}
  />
);
