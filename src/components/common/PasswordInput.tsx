import type { InputHTMLAttributes } from "react";

type PasswordInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  label: string;
  hideLabel?: boolean;
};

export function PasswordInput({
  className,
  hideLabel = false,
  id,
  label,
  ...props
}: PasswordInputProps) {
  return (
    <label className="form-control w-full gap-2" htmlFor={id}>
      <span className={hideLabel ? "sr-only" : "label-text"}>{label}</span>
      <input
        {...props}
        aria-label={label}
        className={["input input-bordered w-full", className]
          .filter(Boolean)
          .join(" ")}
        id={id}
        type="password"
      />
    </label>
  );
}
