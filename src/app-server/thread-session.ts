import { requestAppServerMethod } from "./api";

const inFlightResumes = new Map<string, Promise<void>>();

export function ensureThreadResumed(threadId: string): Promise<void> {
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
}

function clearInFlightResume(threadId: string, resume: Promise<void>): void {
  if (inFlightResumes.get(threadId) === resume) {
    inFlightResumes.delete(threadId);
  }
}
