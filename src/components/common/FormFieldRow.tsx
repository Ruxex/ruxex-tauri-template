import type { ReactNode } from "react";

export function FormFieldRow({
  controlId,
  label,
  children,
}: {
  controlId: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(12rem,40%)] items-center gap-4 px-5 py-3.5 max-sm:grid-cols-1 max-sm:items-start">
      <label className="label-text" htmlFor={controlId}>
        {label}
      </label>
      {children}
    </div>
  );
}
