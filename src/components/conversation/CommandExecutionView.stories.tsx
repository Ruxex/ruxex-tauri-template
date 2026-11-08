import type { Story } from "@ladle/react";

import { CommandExecutionView } from "./CommandExecutionView";

export const Completed: Story = () => (
  <CommandExecutionView
    command="pnpm check"
    exitCode="0"
    result={"All checks passed.\nNo changes required."}
    status="completed"
  />
);

export const Running: Story = () => (
  <CommandExecutionView
    command="pnpm test --watch"
    result={"Running test suite…\nWaiting for file changes."}
    status="inProgress"
  />
);

export const EmptyOutput: Story = () => (
  <CommandExecutionView command="git status --short" result="" status="completed" />
);

export const Failed: Story = () => (
  <CommandExecutionView
    command="pnpm test --runInBand"
    exitCode="1"
    result="Test suite failed with one assertion."
    status="failed"
  />
);
