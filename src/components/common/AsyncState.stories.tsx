import type { Story } from "@ladle/react";
import type { ReactNode } from "react";

import {
  DocumentMagnifyingGlassIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";

import {
  EmptyState,
  ErrorState as ErrorStateView,
  LoadingState,
} from "./AsyncState";

function Surface({ children }: { children: ReactNode }) {
  return <div className="min-w-80 max-w-xl bg-base-200 p-4">{children}</div>;
}

export const Loading: Story = () => (
  <Surface>
    <div className="flex min-h-32 items-center justify-center">
      <LoadingState />
    </div>
  </Surface>
);

export const ErrorState: Story = () => (
  <Surface>
    <ErrorStateView>Unable to load the component data.</ErrorStateView>
  </Surface>
);

export const EmptyWithAction: Story = () => (
  <Surface>
    <EmptyState
      action={
        <button className="btn btn-primary btn-sm" type="button">
          <PlusIcon aria-hidden="true" className="size-4" />
          Create schedule
        </button>
      }
      description="Create one to run an action automatically."
      icon={DocumentMagnifyingGlassIcon}
      title="No schedules yet"
    />
  </Surface>
);
