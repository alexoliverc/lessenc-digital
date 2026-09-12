import type { ComponentPropsWithRef } from "react";

import styles from "./button.module.css";

type ActionVariant = "primary" | "secondary" | "outline" | "ghost" | "destructive";
type ActionSize = "regular" | "small";

type ButtonProps = ComponentPropsWithRef<"button"> & {
  variant?: ActionVariant;
  size?: ActionSize;
  loading?: boolean;
  loadingLabel?: string;
};

export function Button({
  variant = "primary",
  size = "regular",
  loading = false,
  loadingLabel = "Carregando…",
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={[styles.action, className].filter(Boolean).join(" ")}
      data-variant={variant}
      data-size={size}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      <span>{loading ? loadingLabel : children}</span>
      {loading && <span className={styles.spinner} aria-hidden="true" />}
    </button>
  );
}

type LinkActionProps = Omit<ComponentPropsWithRef<"a">, "href"> & {
  href: string;
  variant?: Exclude<ActionVariant, "destructive">;
  size?: ActionSize;
};

export function LinkAction({
  variant = "primary",
  size = "regular",
  className,
  ...props
}: LinkActionProps) {
  return (
    <a
      {...props}
      className={[styles.action, className].filter(Boolean).join(" ")}
      data-variant={variant}
      data-size={size}
    />
  );
}
