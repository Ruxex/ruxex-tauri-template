const SHAPE_COUNT = 256;
const COLORS = [
  "#e53935",
  "#d81b60",
  "#8e24aa",
  "#5e35b1",
  "#3949ab",
  "#1e88e5",
  "#039be5",
  "#00acc1",
  "#00897b",
  "#43a047",
  "#7cb342",
  "#c0ca33",
  "#f9a825",
  "#fb8c00",
  "#f4511e",
  "#6d4c41",
] as const;

export type SubagentIdenticon = {
  shapeIndex: number;
  color: (typeof COLORS)[number];
  url: string;
};

/** Maps a thread ID to a stable shape and color from the bundled identicons. */
export function getSubagentIdenticon(threadId: string): SubagentIdenticon {
  const combination = hashThreadId(threadId) % (SHAPE_COUNT * COLORS.length);
  const shapeIndex = combination % SHAPE_COUNT;
  const color = COLORS[Math.floor(combination / SHAPE_COUNT)];

  return {
    shapeIndex,
    color,
    url: `/subagents/shape-${String(shapeIndex + 1).padStart(3, "0")}.svg`,
  };
}

function hashThreadId(value: string): number {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}
