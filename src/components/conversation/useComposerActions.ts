import {
  useArchiveThread,
  useCompactThread,
  useInterruptTurn,
  useQueueMessage,
  useSendMessage,
  useSetThreadGoal,
  useSteerTurn,
  useUpdateThreadSettings,
} from "../../app-server/hooks";
import type { ComposerSubmissionPlan } from "./composer-model";

export function useComposerActions(threadId: string) {
  const send = useSendMessage();
  const archive = useArchiveThread();
  const compact = useCompactThread();
  const steer = useSteerTurn();
  const queue = useQueueMessage();
  const interrupt = useInterruptTurn();
  const setGoal = useSetThreadGoal();
  const updateSettings = useUpdateThreadSettings();

  async function submit(submission: ComposerSubmissionPlan) {
    switch (submission.kind) {
      case "send":
        await send.mutateAsync(submission.params);
        break;
      case "queue":
        await queue.mutateAsync(submission.params);
        break;
      case "steer":
        await steer.mutateAsync(submission.params);
        break;
      case "goal":
        await setGoal.mutateAsync({
          threadId: submission.threadId,
          objective: submission.objective,
          status: "active",
        });
        break;
    }
  }

  return {
    isPending:
      send.isPending ||
      archive.isPending ||
      compact.isPending ||
      steer.isPending ||
      queue.isPending ||
      interrupt.isPending ||
      setGoal.isPending ||
      updateSettings.isPending,
    error:
      send.error ||
      archive.error ||
      compact.error ||
      steer.error ||
      queue.error ||
      interrupt.error ||
      setGoal.error ||
      updateSettings.error,
    archive: () => archive.mutateAsync({ threadId }),
    compact: () => compact.mutateAsync({ threadId }),
    interrupt: (turnId: string) => interrupt.mutateAsync({ threadId, turnId }),
    submit,
    updateSettings: updateSettings.mutateAsync,
  };
}
