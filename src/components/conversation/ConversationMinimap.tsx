import { useEffect, useMemo, useRef, useState } from "react";

import type { ConversationViewItem } from "./conversation-model";

const MAX_MARKER_GAP_PX = 28;
const MAX_MARKER_SPAN_PX = 360;
export const MIN_USER_ITEMS_FOR_MINIMAP = 5;

type ConversationMinimapProps = {
  items: ConversationViewItem[];
  timelineRef: React.RefObject<HTMLElement | null>;
};

export function ConversationMinimap({
  items,
  timelineRef,
}: ConversationMinimapProps) {
  const userItems = useMemo(
    () => items.filter((item) => item.type === "userMessage"),
    [items],
  );
  const [activeId, setActiveId] = useState<string | null>(
    userItems.at(-1)?.id ?? null,
  );
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const previousLastUserIdRef = useRef<string | null>(
    userItems.at(-1)?.id ?? null,
  );

  useEffect(() => {
    const lastUserId = userItems.at(-1)?.id ?? null;
    if (lastUserId !== previousLastUserIdRef.current) {
      setActiveId(lastUserId);
    }
    previousLastUserIdRef.current = lastUserId;
  }, [userItems]);

  useEffect(() => {
    const timeline = timelineRef.current;
    if (!timeline || userItems.length < MIN_USER_ITEMS_FOR_MINIMAP) {
      return;
    }

    const scrollContainer =
      timeline.closest<HTMLElement>("[data-conversation-scroll]") ?? timeline;

    const findItemElement = (id: string) =>
      Array.from(
        timeline.querySelectorAll<HTMLElement>("[data-conversation-item-id]"),
      ).find((element) => element.dataset.conversationItemId === id);

    const updateActive = () => {
      const viewportCenter =
        scrollContainer.getBoundingClientRect().top +
        scrollContainer.clientHeight / 2;
      const closest = userItems
        .map((item) => ({
          id: item.id,
          element: findItemElement(item.id),
        }))
        .filter(
          (entry): entry is { id: string; element: HTMLElement } =>
            entry.element !== undefined,
        )
        .sort(
          (left, right) =>
            Math.abs(
              left.element.getBoundingClientRect().top - viewportCenter,
            ) -
            Math.abs(
              right.element.getBoundingClientRect().top - viewportCenter,
            ),
        )[0];

      if (closest) {
        setActiveId(closest.id);
      }
    };

    updateActive();
    scrollContainer.addEventListener("scroll", updateActive, {
      passive: true,
    });

    return () => {
      scrollContainer.removeEventListener("scroll", updateActive);
    };
  }, [timelineRef, userItems]);

  if (typeof document === "undefined") {
    return null;
  }

  const hasMarkers = userItems.length >= MIN_USER_ITEMS_FOR_MINIMAP;
  const hoveredIndex = hoveredId
    ? userItems.findIndex((item) => item.id === hoveredId)
    : -1;

  function jumpTo(item: ConversationViewItem) {
    const timeline = timelineRef.current;
    const target = timeline
      ? Array.from(
          timeline.querySelectorAll<HTMLElement>("[data-conversation-item-id]"),
        ).find((element) => element.dataset.conversationItemId === item.id)
      : null;

    target?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    setActiveId(item.id);
    setHoveredId(null);
  }

  if (!hasMarkers) {
    return null;
  }

  return (
    <div className="chat-minimap-column chat-side-column pointer-events-none sticky top-6 z-10 w-auto min-w-0 justify-self-stretch self-start overflow-hidden @container/minimap">
      <aside
        aria-label="Conversation minimap"
        className="hidden h-full w-full overflow-hidden @min-[4rem]/minimap:block"
      >
        <div
          className="pointer-events-auto flex h-full max-h-full w-full items-center overflow-y-auto"
          data-testid="conversation-minimap-scroll"
        >
          <div className="relative h-[min(60vh,520px)] w-4 shrink-0">
            <div
              aria-hidden="true"
              className="conversation-minimap-track absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 rounded-full"
              data-testid="conversation-minimap-track"
            />
            {userItems.map((item, index) => {
              const preview = previewText(item.text);
              const isActive = activeId === item.id;
              const isHovered = hoveredId === item.id;
              const hoverDistance =
                hoveredIndex >= 0 ? Math.abs(index - hoveredIndex) : -1;
              const isAdjacent = hoverDistance === 1;
              const isNear = hoverDistance === 2;
              const isFar = hoverDistance === 3;
              const markerOffsetClass = isHovered
                ? "translate-x-[14px]"
                : isAdjacent
                  ? "translate-x-[10px]"
                  : isNear
                    ? "translate-x-[5px]"
                    : isFar
                      ? "translate-x-[2px]"
                      : "";
              const markerStateClass = isHovered
                ? "scale-200 border-primary bg-primary"
                : isActive
                  ? "scale-150 border-primary bg-primary shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-primary)_24%,transparent)]"
                  : isAdjacent
                    ? "scale-125 border-base-content/30 bg-base-content/45"
                    : isNear
                      ? "scale-110 border-base-content/30 bg-base-content/45"
                      : isFar
                        ? "scale-105 border-base-content/30 bg-base-content/45"
                        : "border-base-content/30 bg-base-content/45";
              return (
                <div
                  className="absolute left-1/2"
                  key={item.id}
                  style={{
                    top: markerPosition(index, userItems.length),
                  }}
                >
                  <button
                    aria-current={isActive ? "location" : undefined}
                    aria-label={`Jump to message: ${preview}`}
                    className="relative flex h-7 w-10 -translate-x-[14px] -translate-y-1/2 items-center justify-center rounded-full border-0 bg-transparent p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
                    onBlur={() => setHoveredId(null)}
                    onClick={() => jumpTo(item)}
                    onFocus={() => setHoveredId(item.id)}
                    onMouseEnter={() => setHoveredId(item.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    type="button"
                  >
                    <span className="absolute left-[10px] top-1/2 -translate-y-1/2">
                      <span
                        aria-hidden="true"
                        className={`block size-2 rounded-full border transition-[transform,background-color,box-shadow] duration-200 ease-out ${markerOffsetClass} ${markerStateClass}`}
                        data-testid={`conversation-minimap-marker-${item.id}`}
                      />
                    </span>
                    {isHovered && (
                      <span
                        className="absolute bottom-1/2 left-10 z-10 w-64 translate-y-1/2 rounded-box border border-base-300 bg-base-100 px-3 py-2 text-left text-xs text-base-content shadow-xl"
                        role="tooltip"
                      >
                        <span className="block leading-relaxed">{preview}</span>
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </aside>
    </div>
  );
}

function previewText(text: string): string {
  const preview = text.replace(/\s+/g, " ").trim();
  const suffix = "...";
  const maxCharacters = 96;
  return preview.length > maxCharacters
    ? `${preview.slice(0, maxCharacters - suffix.length)}${suffix}`
    : preview || "…";
}

function markerPosition(index: number, count: number): string {
  const intervalCount = Math.max(count - 1, 1);
  const gap = Math.min(MAX_MARKER_GAP_PX, MAX_MARKER_SPAN_PX / intervalCount);
  const centerIndex = (count - 1) / 2;
  const offset = (index - centerIndex) * gap;
  return `calc(50% + ${offset}px)`;
}
