import { useLayoutEffect, useRef } from "react";

/** Opens a dialog in the browser's modal top layer while it is mounted. */
export function useNativeModalDialog(open = true) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;

    if (typeof dialog.showModal === "function") {
      dialog.showModal();
      return () => {
        if (dialog.open) dialog.close();
      };
    }

    // Keeps DOM-only environments without the dialog API renderable.
    dialog.setAttribute("open", "");
    return () => dialog.removeAttribute("open");
  }, [open]);

  return dialogRef;
}
