import { FlagIcon } from "@heroicons/react/24/outline";

import { useThreadGoal } from "../../app-server/hooks";

export function CurrentGoal({ threadId }: { threadId: string }) {
  const goal = useThreadGoal(threadId).data?.goal;

  if (goal?.status !== "active") {
    return null;
  }

  return (
    <section
      aria-label="Current goal"
      className="mb-2 flex justify-start"
      data-testid="current-goal"
    >
      <article className="max-w-[min(100%,36rem)] rounded-box border border-base-300 bg-base-100 px-3 py-1.5 text-xs shadow-sm">
        <div className="flex items-start gap-2">
          <FlagIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <p className="whitespace-pre-wrap break-words">{goal.objective}</p>
        </div>
      </article>
    </section>
  );
}
