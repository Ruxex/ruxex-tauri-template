import { XMarkIcon } from "@heroicons/react/24/outline";

export function SidebarHeader({
  label,
  onClose,
}: {
  label: string;
  onClose: () => void;
}) {
  return (
    <div className="mb-5 flex items-center justify-between gap-2">
      <h2 className="truncate text-lg font-semibold">{label}</h2>
      <button
        aria-label="Close sidebar panel"
        className="btn btn-ghost btn-sm"
        type="button"
        onClick={onClose}
      >
        <XMarkIcon aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
