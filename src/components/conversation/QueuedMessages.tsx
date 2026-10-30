import { PhotoIcon, QueueListIcon } from "@heroicons/react/24/outline";

import type { v2 } from "../../protocol";
import { useThreadQueue } from "../../app-server/hooks";

export function QueuedMessages({ threadId }: { threadId: string }) {
  const queue = useThreadQueue(threadId);
  const submissions = queue.data?.data ?? [];

  if (submissions.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Queued messages"
      className="flex justify-end"
      data-testid="queued-messages"
    >
      <div className="flex max-w-full flex-col items-end gap-2">
        {submissions.map((submission) => (
          <QueuedMessage key={submission.id} submission={submission} />
        ))}
      </div>
    </section>
  );
}

function QueuedMessage({
  submission,
}: {
  submission: v2.QueuedSubmission;
}) {
  const text = submission.input
    .map((input) => (input.type === "text" ? input.text : null))
    .filter((value): value is string => value !== null)
    .join("\n");
  const hasNonTextInput = submission.input.some(
    (input) => input.type !== "text",
  );

  return (
    <article className="max-w-[min(100%,36rem)] rounded-box border border-base-300 bg-base-100 px-3 py-2 text-sm shadow-sm">
      <div className="flex items-start gap-2">
        {hasNonTextInput ? (
          <PhotoIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        ) : (
          <QueueListIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        )}
        <p className="whitespace-pre-wrap break-words">
          {text || (hasNonTextInput ? "Image attachment" : "Queued message")}
        </p>
      </div>
    </article>
  );
}
