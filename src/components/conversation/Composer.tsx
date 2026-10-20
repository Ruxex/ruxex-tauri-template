import { useState, type FormEvent } from "react";

import { buildUserTextInput } from "./conversation-model";
import { ComposerOptions } from "./ComposerOptions";
import type { SubmissionMode } from "./composer-model";
import {
  useInterruptTurn,
  useQueueMessage,
  useSendMessage,
  useSteerTurn,
} from "../../app-server/hooks";

type ComposerProps = {
  threadId: string;
  activeTurnId: string | null;
};

export function Composer({ threadId, activeTurnId }: ComposerProps) {
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<SubmissionMode>("send");
  const [planMode, setPlanMode] = useState(false);
  const send = useSendMessage();
  const steer = useSteerTurn();
  const queue = useQueueMessage();
  const interrupt = useInterruptTurn();
  const isPending = send.isPending || steer.isPending || queue.isPending || interrupt.isPending;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = message.trim();
    if (!text || isPending) {
      return;
    }
    const input = [buildUserTextInput(text)];
    try {
      if (mode === "steer") {
        if (!activeTurnId) {
          return;
        }
        await steer.mutateAsync({
          threadId,
          expectedTurnId: activeTurnId,
          input,
        });
      } else if (mode === "queue") {
        await queue.mutateAsync({ threadId, input });
      } else {
        await send.mutateAsync({
          threadId,
          input,
          turnTrigger: planMode ? "plan" : null,
        });
      }
      setMessage("");
    } catch {
      // Mutation state renders the error below the composer.
    }
  }

  return (
    <form className="rounded-box border border-base-300 bg-base-100 p-3 shadow-sm" onSubmit={(event) => void handleSubmit(event)}>
      <textarea
        className="textarea textarea-ghost min-h-24 w-full resize-none"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Ask Ruxex to work on something…"
        disabled={isPending}
        aria-label="Message"
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <ComposerOptions
            activeTurnId={activeTurnId}
            disabled={isPending}
            mode={mode}
            onModeChange={setMode}
            onPlanModeChange={() => setPlanMode((value) => !value)}
            planMode={planMode}
          />
        </div>
        <div className="flex gap-2">
          {activeTurnId && (
            <button
              className="btn btn-error btn-sm btn-outline"
              type="button"
              onClick={() => void interrupt.mutateAsync({ threadId, turnId: activeTurnId })}
              disabled={isPending}
            >
              Stop
            </button>
          )}
          <button className="btn btn-primary btn-sm" type="submit" disabled={isPending || !message.trim()}>
            {isPending ? "Working…" : mode === "queue" ? "Queue" : mode === "steer" ? "Steer" : "Send"}
          </button>
        </div>
      </div>
      {(send.error || steer.error || queue.error || interrupt.error) && (
        <p className="mt-2 text-sm text-error">
          {String(send.error || steer.error || queue.error || interrupt.error)}
        </p>
      )}
    </form>
  );
}
