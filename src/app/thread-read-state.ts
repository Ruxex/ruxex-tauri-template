import {
  createContext,
  createElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export const THREAD_READ_STATE_KEY = "ruxex.thread-read-state";

type ThreadReadState = {
  version: 1;
  readAtByThreadId: Record<string, number>;
};

type ThreadReadStateContextValue = {
  readAtByThreadId: Record<string, number>;
  markThreadRead: (threadId: string, updatedAt: number) => void;
  isThreadUnread: (threadId: string, updatedAt: number) => boolean;
};

const DEFAULT_THREAD_READ_STATE: ThreadReadState = {
  version: 1,
  readAtByThreadId: {},
};

const ThreadReadStateContext =
  createContext<ThreadReadStateContextValue | null>(null);

export function parseThreadReadState(raw: string | null): ThreadReadState {
  if (!raw) return DEFAULT_THREAD_READ_STATE;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      !isRecord(parsed) ||
      parsed.version !== DEFAULT_THREAD_READ_STATE.version ||
      !isRecord(parsed.readAtByThreadId)
    ) {
      return DEFAULT_THREAD_READ_STATE;
    }

    const readAtByThreadId: Record<string, number> = {};
    for (const [threadId, updatedAt] of Object.entries(
      parsed.readAtByThreadId,
    )) {
      if (
        typeof updatedAt === "number" &&
        Number.isFinite(updatedAt) &&
        updatedAt >= 0
      ) {
        readAtByThreadId[threadId] = updatedAt;
      }
    }

    return { version: 1, readAtByThreadId };
  } catch {
    return DEFAULT_THREAD_READ_STATE;
  }
}

export function readThreadReadState(): ThreadReadState {
  if (typeof window === "undefined") {
    return DEFAULT_THREAD_READ_STATE;
  }
  return parseThreadReadState(
    window.localStorage.getItem(THREAD_READ_STATE_KEY),
  );
}

export function writeThreadReadState(state: ThreadReadState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(THREAD_READ_STATE_KEY, JSON.stringify(state));
}

export function ThreadReadStateProvider({ children }: { children: ReactNode }) {
  const [readAtByThreadId, setReadAtByThreadId] = useState(
    () => readThreadReadState().readAtByThreadId,
  );

  useEffect(() => {
    writeThreadReadState({ version: 1, readAtByThreadId });
  }, [readAtByThreadId]);

  const markThreadRead = useCallback((threadId: string, updatedAt: number) => {
    if (!threadId || !Number.isFinite(updatedAt) || updatedAt < 0) return;

    setReadAtByThreadId((current) => {
      const previous = current[threadId];
      if (previous !== undefined && previous >= updatedAt) {
        return current;
      }
      return { ...current, [threadId]: updatedAt };
    });
  }, []);

  const isThreadUnread = useCallback(
    (threadId: string, updatedAt: number) => {
      if (!Number.isFinite(updatedAt) || updatedAt < 0) return false;
      const readAt = readAtByThreadId[threadId];
      return readAt === undefined || updatedAt > readAt;
    },
    [readAtByThreadId],
  );

  return createElement(
    ThreadReadStateContext.Provider,
    { value: { readAtByThreadId, markThreadRead, isThreadUnread } },
    children,
  );
}

export function useThreadReadState(): ThreadReadStateContextValue {
  const value = useContext(ThreadReadStateContext);
  if (!value) {
    throw new Error(
      "useThreadReadState must be used within ThreadReadStateProvider",
    );
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
