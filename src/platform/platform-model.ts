export type DeepLinkTarget =
  | { kind: "thread"; id: string }
  | { kind: "project"; id: string };

export type RemoteEndpointConfig = {
  url: string;
};

export type ScheduleCadence =
  | { kind: "once"; at: string }
  | { kind: "daily"; hour: number; minute: number }
  | { kind: "weekly"; weekdays: number[]; hour: number; minute: number };

export type ScheduleSpec = {
  name: string;
  prompt: string;
  cadence: ScheduleCadence;
};

export function normalizeDeepLink(value: string): DeepLinkTarget | null {
  if (/(^|\/)\.\.(\/|$)/.test(value)) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (
    url.protocol !== "ruxex:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    return null;
  }

  const id = decodePathSegment(url.pathname);
  if (!id || (url.hostname !== "thread" && url.hostname !== "project")) {
    return null;
  }

  return { kind: url.hostname, id };
}

export function validateRemoteEndpoint(
  value: string,
): RemoteEndpointConfig | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.username || url.password || !url.pathname || url.search || url.hash) {
    return null;
  }
  if (url.protocol === "wss:") {
    return { url: url.toString() };
  }
  if (url.protocol === "ws:" && isLoopbackHost(url.hostname)) {
    return { url: url.toString() };
  }
  return null;
}

export function validateScheduleSpec(value: ScheduleSpec): boolean {
  if (!value.name.trim() || !value.prompt.trim() || value.name.length > 120) {
    return false;
  }

  switch (value.cadence.kind) {
    case "once":
      return Number.isFinite(Date.parse(value.cadence.at));
    case "daily":
      return validTime(value.cadence.hour, value.cadence.minute);
    case "weekly":
      return (
        value.cadence.weekdays.length > 0 &&
        value.cadence.weekdays.every(
          (weekday) =>
            Number.isInteger(weekday) && weekday >= 0 && weekday <= 6,
        ) &&
        validTime(value.cadence.hour, value.cadence.minute)
      );
  }
}

export function validateWorktreePath(
  root: string,
  destination: string,
): boolean {
  if (!root.startsWith("/") || !destination.startsWith("/")) {
    return false;
  }
  if ([root, destination].some((value) => value.includes("\\"))) {
    return false;
  }
  if ([root, destination].some((value) => value.split("/").includes(".."))) {
    return false;
  }
  const normalizedRoot = trimTrailingSlashes(root);
  const normalizedDestination = trimTrailingSlashes(destination);
  return (
    normalizedDestination.startsWith(`${normalizedRoot}/`) &&
    normalizedDestination !== normalizedRoot
  );
}

function decodePathSegment(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length !== 1) {
    return null;
  }
  try {
    const id = decodeURIComponent(segments[0]);
    return /^[A-Za-z0-9][A-Za-z0-9._~-]*$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"
  );
}

function validTime(hour: number, minute: number): boolean {
  return (
    Number.isInteger(hour) &&
    hour >= 0 &&
    hour <= 23 &&
    Number.isInteger(minute) &&
    minute >= 0 &&
    minute <= 59
  );
}

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "") || "/";
}
