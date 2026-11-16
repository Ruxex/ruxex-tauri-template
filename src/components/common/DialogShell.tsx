import { useTranslation } from "react-i18next";
import {
  useId,
  type ComponentType,
  type ReactNode,
  type SVGProps,
} from "react";

import { DialogHeader } from "./DialogParts";
import { useNativeModalDialog } from "./useNativeModalDialog";

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
  closeLabel,
  icon,
  onClose,
  open,
  title,
  titleId,
}: DialogShellProps) {
  const { t } = useTranslation("common");
  const resolvedCloseLabel = closeLabel ?? t("common:closeDialog");
  const generatedTitleId = useId();
  const resolvedTitleId = titleId ?? generatedTitleId;
  const dialogRef = useNativeModalDialog(open);

  if (!open) {
    return null;
  }

  return (
    <dialog
      aria-labelledby={resolvedTitleId}
      className="modal"
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="modal-box w-full max-w-2xl overflow-visible px-5 py-7">
        <DialogHeader
          closeLabel={resolvedCloseLabel}
          icon={icon}
          onClose={onClose}
          title={title}
          titleId={resolvedTitleId}
        />
        {children}
      </div>
      <form className="modal-backdrop" method="dialog">
        <button aria-label={resolvedCloseLabel} type="button" onClick={onClose}>
          {t("common:close")}
        </button>
      </form>
    </dialog>
  );
}
