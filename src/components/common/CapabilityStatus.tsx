import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";

export type CapabilityStatusState =
  | "enabled"
  | "disabled"
  | "unsupported";

export function CapabilityStatus({
  label,
  state,
}: {
  label: string;
  state: CapabilityStatusState;
}) {
  if (state === "unsupported") {
    return (
      <span className="text-sm text-base-content/70" role="status">
        {label}
      </span>
    );
  }

  const Icon = state === "enabled" ? CheckIcon : XMarkIcon;

  return (
    <span
      aria-label={label}
      className={state === "enabled" ? "text-success" : "text-error"}
      role="status"
      title={label}
    >
      <Icon aria-hidden="true" className="size-5" />
    </span>
  );
}
