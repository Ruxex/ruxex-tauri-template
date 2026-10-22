import { useState } from "react";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";

import { useStartReview } from "../../app-server/hooks";

export function ReviewControls({ threadId }: { threadId: string }) {
  const review = useStartReview();
  const [message, setMessage] = useState<string | null>(null);

  async function startReview() {
    setMessage(null);
    try {
      await review.mutateAsync({
        threadId,
        target: { type: "uncommittedChanges" },
        delivery: "inline",
      });
      setMessage("Review started.");
    } catch {
      // Mutation state renders the error below the action.
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        className="btn btn-outline btn-sm"
        type="button"
        disabled={review.isPending}
        onClick={() => void startReview()}
      >
        <MagnifyingGlassIcon aria-hidden="true" className="size-4" />
        {review.isPending ? "Starting review…" : "Review changes"}
      </button>
      {message && <span className="text-sm text-success">{message}</span>}
      {review.isError && (
        <span className="text-sm text-error">{String(review.error)}</span>
      )}
    </div>
  );
}
