import { requestAppServerMethod } from "./api";

const inFlightResumes = new Map<string, Promise<void>>();
const skipNextResumeThreadIds = new Set<string>();

export type EnsureThreadResumedOptions = {
  consumeStarted?: boolean;
};

export function markThreadStarted(threadId: string): void {
  skipNextResumeThreadIds.add(threadId);
}

export function ensureThreadResumed(
  threadId: string,
  options: EnsureThreadResumedOptions = {},
): Promise<void> {
  if (skipNextResumeThreadIds.has(threadId)) {
    if (options.consumeStarted !== false) {
      skipNextResumeThreadIds.delete(threadId);
    }
    return Promise.resolve();
  }

  const existing = inFlightResumes.get(threadId);
  if (existing) {
    return existing;
  }

  const resume = requestThreadResume(threadId);
  inFlightResumes.set(threadId, resume);

  void resume.then(
    () => clearInFlightResume(threadId, resume),
    () => clearInFlightResume(threadId, resume),
  );

  return resume;
}

async function requestThreadResume(threadId: string): Promise<void> {
  try {
    await requestAppServerMethod("thread/resume", {
      threadId,
      excludeTurns: true,
    });
  } catch (error: unknown) {
    if (!isHistoryPaginationUnsupported(error)) {
      throw error;
    }
    await requestAppServerMethod("thread/resume", {
      threadId,
      excludeTurns: false,
    });
  }
}

function isHistoryPaginationUnsupported(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const candidate = error as { code?: unknown; message?: unknown };
  return (
    candidate.code === -32601 &&
    typeof candidate.message === "string" &&
    /^list_(turns|items) is not supported yet$/.test(candidate.message)
  );
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
