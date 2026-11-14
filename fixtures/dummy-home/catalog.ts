export type PersistentScenarioId =
  | "basic"
  | "long-markdown"
  | "multi-turn"
  | "command-success"
  | "command-list"
  | "command-large"
  | "command-fail"
  | "approval-accepted"
  | "approval-denied"
  | "provider-error"
  | "rate-limit"
  | "disconnect"
  | "goal-only";

export type PersistentScenarioKind =
  | "conversation"
  | "multiTurn"
  | "approval"
  | "goal";

export type PersistentScenario = {
  readonly id: PersistentScenarioId;
  readonly count: number;
  readonly kind: PersistentScenarioKind;
  readonly providerMarker: string;
  readonly completionText?: string;
  readonly errorText?: string;
  readonly turnCount?: number;
  readonly goalText?: string;
  readonly archiveOccurrences?: readonly number[];
};

export type ProjectFixture = {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly color: string;
  readonly roots: readonly string[];
  readonly threadScenarioIds: readonly PersistentScenarioId[];
};

export type VolatileScenarioId =
  | "pending-approval"
  | "pending-user-input"
  | "pending-permissions"
  | "slow-stream"
  | "long-stream-running"
  | "long-stream-completed"
  | "completed-turn-details"
  | "conversation-minimap"
  | "queued-message"
  | "pending-mcp-elicitation"
  | "disconnect-recovery";

export type VolatileScenario = {
  readonly id: VolatileScenarioId;
  readonly count: number;
  readonly providerMarker: string;
  readonly screenshotName: string;
};

export const PAGE_DENSITY_COUNTS = {
  ordinary: {
    activeThreads: 12,
    unassignedThreads: 9,
    projectAssignedThreads: 3,
    archivedThreads: 2,
    projects: 3,
    projectThreads: 2,
    schedules: 1,
    mcpServers: 1,
  },
  large: {
    activeThreads: 24,
    unassignedThreads: 11,
    projectAssignedThreads: 13,
    archivedThreads: 60,
    projects: 24,
    projectThreads: 12,
    schedules: 12,
    mcpServers: 12,
  },
} as const;

export const LARGE_DATA_ADDITIONS = {
  activeThreads: 12,
  archivedThreads: 58,
  projectThreads: 10,
  projects: 21,
  schedules: 11,
  mcpServers: 11,
} as const;

export const PERSISTENT_SCENARIOS: readonly PersistentScenario[] = [
  {
    id: "basic",
    count: 2,
    kind: "conversation",
    providerMarker: "example:basic",
    completionText: "This is a fixed response from the dummy provider.",
    archiveOccurrences: [2],
  },
  {
    id: "long-markdown",
    count: 1,
    kind: "conversation",
    providerMarker: "example:long-stream",
    completionText: "Long stream fixture",
  },
  {
    id: "multi-turn",
    count: 1,
    kind: "multiTurn",
    providerMarker: "example:multi",
    completionText: "This is the completion turn of the multi-turn test.",
    turnCount: 3,
  },
  {
    id: "command-success",
    count: 1,
    kind: "conversation",
    providerMarker: "example:command",
    completionText: "The command result was received.",
  },
  {
    id: "command-list",
    count: 1,
    kind: "conversation",
    providerMarker: "example:command:ls",
    completionText: "The command result was received.",
  },
  {
    id: "command-large",
    count: 1,
    kind: "conversation",
    providerMarker: "example:command:large",
    completionText: "The command result was received.",
  },
  {
    id: "command-fail",
    count: 1,
    kind: "conversation",
    providerMarker: "example:command:fail",
    errorText: "example-provider stderr",
  },
  {
    id: "approval-accepted",
    count: 1,
    kind: "approval",
    providerMarker: "example:approval",
    completionText: "The approved command result was received.",
  },
  {
    id: "approval-denied",
    count: 1,
    kind: "approval",
    providerMarker: "example:approval:deny",
    completionText: "The approval was denied by the client.",
  },
  {
    id: "provider-error",
    count: 1,
    kind: "conversation",
    providerMarker: "example:error",
    errorText: "example provider transient error",
    archiveOccurrences: [1],
  },
  {
    id: "rate-limit",
    count: 1,
    kind: "conversation",
    providerMarker: "example:rate-limit",
    errorText: "rate limit",
  },
  {
    id: "disconnect",
    count: 1,
    kind: "conversation",
    providerMarker: "example:disconnect",
    errorText: "example provider disconnected after partial output",
  },
  {
    id: "goal-only",
    count: 1,
    kind: "goal",
    providerMarker: "example:basic",
    goalText: "Prepare the fixture review checklist.",
  },
];

export const PROJECT_FIXTURES: readonly ProjectFixture[] = [
  {
    id: "product-planning",
    name: "Product planning",
    icon: "briefcase",
    color: "blue",
    roots: [],
    threadScenarioIds: ["basic", "multi-turn"],
  },
  {
    id: "design-review",
    name: "Design review",
    icon: "globe",
    color: "violet",
    roots: [],
    threadScenarioIds: ["command-success"],
  },
  {
    id: "empty-project",
    name: "Empty project",
    icon: "folder",
    color: "orange",
    roots: [],
    threadScenarioIds: [],
  },
];

export const VOLATILE_SCENARIOS: readonly VolatileScenario[] = [
  {
    id: "pending-approval",
    count: 1,
    providerMarker: "example:approval",
    screenshotName: "pending-approval.png",
  },
  {
    id: "pending-user-input",
    count: 1,
    providerMarker: "example:user-input",
    screenshotName: "pending-user-input.png",
  },
  {
    id: "pending-permissions",
    count: 1,
    providerMarker: "example:permissions",
    screenshotName: "pending-permissions.png",
  },
  {
    id: "slow-stream",
    count: 1,
    providerMarker: "example:long-stream:slow",
    screenshotName: "slow-stream.png",
  },
  {
    id: "long-stream-running",
    count: 1,
    providerMarker: "example:long-stream:slow",
    screenshotName: "long-stream-running.png",
  },
  {
    id: "long-stream-completed",
    count: 1,
    providerMarker: "example:long-stream",
    screenshotName: "long-stream-completed.png",
  },
  {
    id: "completed-turn-details",
    count: 1,
    providerMarker: "example:workflow",
    screenshotName: "completed-turn-details-collapsed.png",
  },
  {
    id: "conversation-minimap",
    count: 1,
    providerMarker: "example:basic",
    screenshotName: "conversation-minimap.png",
  },
  {
    id: "queued-message",
    count: 1,
    providerMarker: "example:basic:slow",
    screenshotName: "queued-message.png",
  },
  {
    id: "pending-mcp-elicitation",
    count: 0,
    providerMarker: "example:mcp",
    screenshotName: "pending-mcp-elicitation.png",
  },
  {
    id: "disconnect-recovery",
    count: 1,
    providerMarker: "example:disconnect",
    screenshotName: "disconnect-recovery.png",
  },
];

export function buildScenarioTitle(
  scenario: Pick<PersistentScenario, "id">,
  occurrence: number,
): string {
  return `Fixture ${scenario.id.replaceAll("-", " ")} ${formatOccurrence(occurrence)}`;
}

export function buildScenarioMarker(
  scenario: Pick<PersistentScenario, "id" | "providerMarker">,
  occurrence: number,
): string {
  return `${buildScenarioTitle(scenario, occurrence)} ${scenario.providerMarker}`;
}

export function persistentFixtureCounts(): {
  total: number;
  active: number;
  archived: number;
} {
  const total = PERSISTENT_SCENARIOS.reduce(
    (sum, scenario) => sum + scenario.count,
    0,
  );
  const archived = PERSISTENT_SCENARIOS.reduce(
    (sum, scenario) => sum + (scenario.archiveOccurrences?.length ?? 0),
    0,
  );
  return { total, active: total - archived, archived };
}

function formatOccurrence(occurrence: number): string {
  return String(occurrence).padStart(2, "0");
}
