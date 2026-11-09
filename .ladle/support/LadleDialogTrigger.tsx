import { useState, type ReactNode } from "react";

type LadleDialogTriggerProps = {
  label?: string;
  renderDialog: (onClose: () => void) => ReactNode;
};

export function LadleDialogTrigger({
  label = "Open dialog",
  renderDialog,
}: LadleDialogTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex flex-col items-start gap-4">
      <button
        aria-haspopup="dialog"
        className="btn btn-outline btn-sm"
        type="button"
        onClick={() => setIsOpen(true)}
      >
        {label}
      </button>
      {isOpen && renderDialog(() => setIsOpen(false))}
    </div>
  );
}
