import { requestAppServerMethod } from "./api";

const inFlightResumes = new Map<string, Promise<void>>();
const skipNextResumeThreadIds = new Set<string>();

export function markThreadStarted(threadId: string): void {
  skipNextResumeThreadIds.add(threadId);
}

export function ensureThreadResumed(threadId: string): Promise<void> {
  if (skipNextResumeThreadIds.delete(threadId)) {
    return Promise.resolve();
  }

  const existing = inFlightResumes.get(threadId);
  if (existing) {
    return existing;
  }

  const resume = requestAppServerMethod("thread/resume", {
    threadId,
    excludeTurns: true,
  }).then(() => undefined);
  inFlightResumes.set(threadId, resume);

  void resume.then(
    () => clearInFlightResume(threadId, resume),
    () => clearInFlightResume(threadId, resume),
  );

  return resume;
}

export function resetThreadSessionState(): void {
  inFlightResumes.clear();
  skipNextResumeThreadIds.clear();
}

function clearInFlightResume(threadId: string, resume: Promise<void>): void {
  if (inFlightResumes.get(threadId) === resume) {
    inFlightResumes.delete(threadId);
  }
}
