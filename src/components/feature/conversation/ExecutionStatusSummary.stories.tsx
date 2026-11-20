import type { Story } from "@ladle/react";
import { StoryVariantList } from "../../../../.ladle/support/StoryVariantList";
import { ExecutionStatusSummary, ExitCodeDisplay } from "./ExecutionStatusSummary";

export default { title: "Feature / Conversation / Execution Status Summary" };

export const States: Story = () => (
  <StoryVariantList
    variants={[
      {
        content: <ExecutionStatusSummary status="completed" exitCode="0" subject="Command" />,
        label: "Completed",
      },
      {
        content: <ExecutionStatusSummary status="failed" exitCode="1" subject="Command" />,
        label: "Failed",
      },
      {
        content: <ExitCodeDisplay exitCode="1" />,
        label: "Non-zero exit code",
      },
    ]}
  />
);
