import { XMarkIcon } from "@heroicons/react/24/outline";
import type { ComponentType, ReactNode, SVGProps } from "react";

type DialogIcon = ComponentType<SVGProps<SVGSVGElement>>;

export function DialogHeader({
  title,
  titleId,
  closeLabel,
  disabled = false,
  onClose,
  icon: Icon,
}: {
  title: ReactNode;
  titleId: string;
  closeLabel?: string;
  disabled?: boolean;
  onClose?: () => void;
  icon?: DialogIcon;
}) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {Icon && (
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon aria-hidden="true" className="size-5" />
          </div>
        )}
        <h2 className="truncate font-semibold" id={titleId}>
          {title}
        </h2>
      </div>
      {onClose && closeLabel && (
        <button
          aria-label={closeLabel}
          className="btn btn-ghost btn-sm btn-square"
          disabled={disabled}
          type="button"
          onClick={onClose}
        >
          <XMarkIcon aria-hidden="true" className="size-4" />
        </button>
      )}
    </div>
  );
}

export function DialogFooter({ children }: { children: ReactNode }) {
  return (
    <footer className="mt-6 flex justify-end gap-2 border-t border-base-300 pt-4">
      {children}
    </footer>
  );
}
