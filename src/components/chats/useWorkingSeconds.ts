import { useEffect, useState } from "react";

export function useWorkingSeconds(
  startedAt: number | null | undefined,
): number | null {
  const [now, setNow] = useState(() => Date.now());
  const hasValidStart = startedAt !== null && Number.isFinite(startedAt);

  useEffect(() => {
    if (!hasValidStart) return;
    const updateNow = () => setNow(Date.now());
    updateNow();
    const intervalId = window.setInterval(updateNow, 1_000);
    return () => window.clearInterval(intervalId);
  }, [hasValidStart]);

  if (!hasValidStart || startedAt === undefined) return null;
  return Math.max(0, Math.floor(now / 1_000 - startedAt));
}
