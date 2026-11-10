import type { InputHTMLAttributes } from "react";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
};

export function PasswordInput({
  className,
  id,
  label,
  ...props
}: PasswordInputProps) {
  return (
    <label className="form-control w-full gap-2" htmlFor={id}>
      <span className="label-text">{label}</span>
      <input
        {...props}
        className={["input input-bordered w-full", className]
          .filter(Boolean)
          .join(" ")}
        id={id}
        type="password"
      />
    </label>
  );
}
