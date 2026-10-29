import { useLayoutEffect, useRef } from "react";

import type { PendingServerRequest } from "../../app-server/event-reducer";
import type { ConversationViewItem } from "../conversation/conversation-model";

const BOTTOM_TOLERANCE_PX = 24;

function scrollContainerFor(timeline: HTMLElement): HTMLElement {
  return (
    timeline.closest<HTMLElement>("[data-conversation-scroll]") ?? timeline
  );
}

type UseTimelineAutoScrollOptions = {
  items: ConversationViewItem[];
  pendingRequests: PendingServerRequest[];
};

export function useTimelineAutoScroll({
  items,
  pendingRequests,
}: UseTimelineAutoScrollOptions) {
  const timelineRef = useRef<HTMLElement | null>(null);
  const wasAtBottomRef = useRef(true);
  const previousItemKeysRef = useRef<Set<string> | null>(null);
  const previousContentSignatureRef = useRef<string | null>(null);
  const itemKeys = items.map((item) => `${item.turnId}:${item.id}`);
  const contentSignature = [
    ...items.map(
      (item) => `${item.turnId}:${item.id}:${item.type}:${item.text}`,
    ),
    ...pendingRequests.map((request) => `request:${String(request.requestId)}`),
  ].join("\u0000");

  useLayoutEffect(() => {
    const timeline = timelineRef.current;
    if (!timeline) {
      return;
    }
    const scrollContainer = scrollContainerFor(timeline);

    const updateBottomState = () => {
      wasAtBottomRef.current =
        scrollContainer.scrollHeight -
          scrollContainer.scrollTop -
          scrollContainer.clientHeight <=
        BOTTOM_TOLERANCE_PX;
    };

    updateBottomState();
    scrollContainer.addEventListener("scroll", updateBottomState);
    return () =>
      scrollContainer.removeEventListener("scroll", updateBottomState);
  }, []);

  useLayoutEffect(() => {
    const previousItemKeys = previousItemKeysRef.current;
    const previousContentSignature = previousContentSignatureRef.current;
    previousItemKeysRef.current = new Set(itemKeys);
    previousContentSignatureRef.current = contentSignature;

    if (
      previousItemKeys === null ||
      previousContentSignature === contentSignature
    ) {
      return;
    }

    const addedUserMessage = items.some(
      (item) =>
        item.type === "userMessage" &&
        !previousItemKeys.has(`${item.turnId}:${item.id}`),
    );
    if (!addedUserMessage && !wasAtBottomRef.current) {
      return;
    }

    const timeline = timelineRef.current;
    if (!timeline) {
      return;
    }
    const scrollContainer = scrollContainerFor(timeline);
    if (typeof scrollContainer.scrollTo === "function") {
      scrollContainer.scrollTo({
        behavior: "smooth",
        top: scrollContainer.scrollHeight,
      });
    } else {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
    wasAtBottomRef.current = true;
  }, [contentSignature, itemKeys, items]);

  return timelineRef;
}
