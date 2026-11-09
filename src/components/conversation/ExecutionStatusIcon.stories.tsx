import type { Story } from "@ladle/react";

import { StoryVariantList } from "../../../.ladle/support/StoryVariantList";

import { ExecutionStatusIcon } from "./ExecutionStatusIcon";

export const States: Story = () => (
  <StoryVariantList
    variants={[
      {
        content: <ExecutionStatusIcon status="inProgress" />,
        label: "Loading",
      },
      {
        content: <ExecutionStatusIcon status="completed" />,
        label: "Completed",
      },
      {
        content: <ExecutionStatusIcon status="failed" />,
        label: "Failed",
      },
      {
        content: <ExecutionStatusIcon exitCode="0" />,
        label: "Exit code 0",
      },
      {
        content: <ExecutionStatusIcon exitCode="1" status="failed" />,
        label: "Exit code 1",
      },
    ]}
  />
);
