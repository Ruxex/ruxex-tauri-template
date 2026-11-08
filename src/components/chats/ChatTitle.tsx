import { useLayoutEffect, useRef, useState } from "react";

export function ChatTitle({
  isHovered,
  title,
}: {
  isHovered: boolean;
  title: string;
}) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflowDistance, setOverflowDistance] = useState(0);

  useLayoutEffect(() => {
    function measure() {
      const container = containerRef.current;
      const text = textRef.current;
      if (!container || !text || text.textContent !== title) return;
      setOverflowDistance(
        Math.max(0, text.scrollWidth - container.clientWidth),
      );
    }

    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }

    const observer = new ResizeObserver(measure);
    if (containerRef.current) observer.observe(containerRef.current);
    if (textRef.current) observer.observe(textRef.current);
    return () => observer.disconnect();
  }, [title]);

  const isOverflowing = overflowDistance > 0;
  const slideDurationMs = Math.max(4500, Math.round(overflowDistance * 37.5));

  return (
    <span
      ref={containerRef}
      className="relative min-w-0 flex-1 overflow-hidden whitespace-nowrap"
      data-title-overflowing={isOverflowing}
    >
      <span
        ref={textRef}
        className={`block truncate font-medium transition-opacity duration-200 ${isHovered && isOverflowing ? "opacity-0" : ""}`}
        data-title-text
      >
        {title}
      </span>
      {isOverflowing && (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute left-0 top-0 whitespace-nowrap transition-transform ease-linear ${isHovered ? "opacity-100" : "opacity-0"}`}
          data-title-marquee
          style={{
            transform: `translateX(${isHovered ? -overflowDistance : 0}px)`,
            transitionDelay: isHovered ? "200ms" : "0ms",
            transitionDuration: `${slideDurationMs}ms`,
          }}
        >
          {title}
        </span>
      )}
    </span>
  );
}
