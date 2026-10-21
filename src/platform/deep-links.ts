import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";

import { normalizeDeepLink, type DeepLinkTarget } from "./platform-model";

export type DeepLinkHandler = (target: DeepLinkTarget) => void;

export async function startDeepLinkListener(
  handler: DeepLinkHandler,
): Promise<() => void> {
  const handled = new Set<string>();
  const process = (urls: string[]) => {
    for (const value of urls) {
      const target = normalizeDeepLink(value);
      if (!target) {
        continue;
      }
      const key = `${target.kind}:${target.id}`;
      if (handled.has(key)) {
        continue;
      }
      handled.add(key);
      handler(target);
    }
  };

  const unlisten = await onOpenUrl(process);
  const current = await getCurrent();
  if (current) {
    process(current);
  }
  return unlisten;
}

export function pathForDeepLink(target: DeepLinkTarget): string {
  return target.kind === "thread"
    ? `/chat/${target.id}`
    : `/projects/${target.id}`;
}
