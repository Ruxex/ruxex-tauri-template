import { useId, type ComponentType, type ReactNode, type SVGProps } from "react";

import { DialogHeader } from "./DialogParts";

type DialogShellProps = {
  children: ReactNode;
  closeLabel?: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  onClose: () => void;
  open: boolean;
  title: ReactNode;
  titleId?: string;
};

export function DialogShell({
  children,
  closeLabel = "Close dialog",
  icon,
  onClose,
  open,
  title,
  titleId,
}: DialogShellProps) {
  const generatedTitleId = useId();
  const resolvedTitleId = titleId ?? generatedTitleId;

  if (!open) {
    return null;
  }

  return (
    <dialog
      aria-labelledby={resolvedTitleId}
      aria-modal="true"
      className="modal"
      open
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="modal-box w-full max-w-2xl overflow-visible px-5 py-7">
        <DialogHeader
          closeLabel={closeLabel}
          icon={icon}
          onClose={onClose}
          title={title}
          titleId={resolvedTitleId}
        />
        {children}
      </div>
      <form className="modal-backdrop" method="dialog">
        <button aria-label={closeLabel} type="button" onClick={onClose}>
          Close
        </button>
      </form>
    </dialog>
  );
}
