import type { ComponentPropsWithRef } from "react";

import styles from "./field.module.css";

type TextFieldProps = Omit<ComponentPropsWithRef<"input">, "id" | "size"> & {
  id: string;
  label: string;
  helperText?: string;
  error?: string;
  wrapperClassName?: string;
};

export function TextField({
  id,
  label,
  helperText,
  error,
  wrapperClassName,
  className,
  required,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  ...props
}: TextFieldProps) {
  const helperId = helperText ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const description = [describedBy, helperId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={[styles.field, wrapperClassName].filter(Boolean).join(" ")}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      <input
        {...props}
        id={id}
        required={required}
        aria-describedby={description}
        aria-invalid={error ? true : invalid}
        className={[styles.input, className].filter(Boolean).join(" ")}
      />
      {helperText && (
        <p id={helperId} className={styles.helper}>
          {helperText}
        </p>
      )}
      {error && (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
