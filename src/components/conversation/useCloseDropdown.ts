import { useEffect, useRef } from "react";

export function useCloseDropdownOnOutsidePointerDown() {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const details = detailsRef.current;
      const target = event.target;

      if (
        details?.open &&
        target instanceof Node &&
        !details.contains(target)
      ) {
        details.removeAttribute("open");
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () =>
      document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  return detailsRef;
}
