import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { ConversationViewItem } from "./conversation-model";

type ConversationMinimapProps = {
  items: ConversationViewItem[];
  timelineRef: React.RefObject<HTMLElement | null>;
};

type MarkerPosition = {
  id: string;
  position: number;
};

export function ConversationMinimap({
  items,
  timelineRef,
}: ConversationMinimapProps) {
  const userItems = useMemo(
    () => items.filter((item) => item.type === "userMessage"),
    [items],
  );
  const [positions, setPositions] = useState<MarkerPosition[]>([]);
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
    if (!timeline || userItems.length === 0) {
      return;
    }

    const scrollContainer =
      timeline.closest<HTMLElement>("[data-conversation-scroll]") ?? timeline;

    const findItemElement = (id: string) =>
      Array.from(
        timeline.querySelectorAll<HTMLElement>("[data-conversation-item-id]"),
      ).find((element) => element.dataset.conversationItemId === id);

    const fallbackPosition = (index: number) =>
      userItems.length === 1 ? 0.5 : index / (userItems.length - 1);

    const measure = () => {
      const scrollRect = scrollContainer.getBoundingClientRect();
      const scrollHeight = Math.max(scrollContainer.scrollHeight, 1);
      const nextPositions = userItems.map<MarkerPosition>((item, index) => {
        const element = findItemElement(item.id);
        if (!element) {
          return { id: item.id, position: fallbackPosition(index) };
        }

        const rect = element.getBoundingClientRect();
        const absoluteTop =
          rect.top - scrollRect.top + scrollContainer.scrollTop;
        const position = (absoluteTop + rect.height / 2) / scrollHeight;
        return {
          id: item.id,
          position: clamp(position, 0.025, 0.975),
        };
      });
      setPositions(nextPositions);
    };

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

    measure();
    updateActive();
    scrollContainer.addEventListener("scroll", updateActive, {
      passive: true,
    });
    window.addEventListener("resize", measure);

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    resizeObserver?.observe(timeline);

    return () => {
      scrollContainer.removeEventListener("scroll", updateActive);
      window.removeEventListener("resize", measure);
      resizeObserver?.disconnect();
    };
  }, [timelineRef, userItems]);

  if (userItems.length === 0 || typeof document === "undefined") {
    return null;
  }

  const positionFor = (id: string, index: number) =>
    positions.find((marker) => marker.id === id)?.position ??
    (userItems.length === 1 ? 0.5 : index / (userItems.length - 1));
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

  return createPortal(
    <aside
      aria-label="Conversation minimap"
      className="pointer-events-none fixed top-1/2 z-30 hidden -translate-y-1/2 min-[1760px]:flex"
      style={{ left: "max(1rem, calc(50% - 520px))" }}
    >
      <div className="pointer-events-auto relative h-[min(60vh,520px)] w-4">
        <div
          aria-hidden="true"
          className="conversation-minimap-track absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 rounded-full"
          data-testid="conversation-minimap-track"
        />
        {userItems.map((item, index) => {
          const preview = previewText(item.text);
          const isActive = activeId === item.id;
          const isHovered = hoveredId === item.id;
          const isAdjacent =
            hoveredIndex >= 0 && Math.abs(index - hoveredIndex) === 1;
          const isNear =
            hoveredIndex >= 0 && Math.abs(index - hoveredIndex) === 2;
          const markerOffsetClass = isHovered
            ? "translate-x-[14px]"
            : isAdjacent
              ? "translate-x-[8px]"
              : isNear
                ? "translate-x-[3px]"
                : "";
          const markerStateClass = isHovered
            ? "scale-200 border-primary bg-primary"
            : isActive
              ? "scale-150 border-primary bg-primary shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-primary)_24%,transparent)]"
              : isAdjacent
                ? "scale-125 border-base-content/30 bg-base-content/45"
                : isNear
                  ? "scale-110 border-base-content/30 bg-base-content/45"
                  : "border-base-content/30 bg-base-content/45";
          return (
            <div
              className="absolute left-1/2"
              key={item.id}
              style={{
                top: `${positionFor(item.id, index) * 100}%`,
              }}
            >
              <button
                aria-current={isActive ? "location" : undefined}
                aria-label={`Jump to message: ${preview}`}
                className="relative flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-0 bg-transparent p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
                onBlur={() => setHoveredId(null)}
                onClick={() => jumpTo(item)}
                onFocus={() => setHoveredId(item.id)}
                onMouseEnter={() => setHoveredId(item.id)}
                onMouseLeave={() => setHoveredId(null)}
                type="button"
              >
                <span
                  aria-hidden="true"
                  className={`block size-2 rounded-full border transition-[transform,background-color,box-shadow] duration-200 ease-out ${markerOffsetClass} ${markerStateClass}`}
                  data-testid={`conversation-minimap-marker-${item.id}`}
                />
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
    </aside>,
    document.body,
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}
