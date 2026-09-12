import type { ComponentPropsWithRef } from "react";

import styles from "./feedback.module.css";

type FeedbackTone = "information" | "success" | "warning" | "danger";

type AlertProps = ComponentPropsWithRef<"div"> & {
  tone?: FeedbackTone;
  heading: string;
};

export function Alert({
  tone = "information",
  heading,
  className,
  role,
  children,
  ...props
}: AlertProps) {
  return (
    <div
      {...props}
      className={[styles.alert, className].filter(Boolean).join(" ")}
      data-tone={tone}
      role={role ?? (tone === "danger" ? "alert" : "status")}
    >
      <strong className={styles.alertHeading}>{heading}</strong>
      {children && <div>{children}</div>}
    </div>
  );
}

type BadgeProps = ComponentPropsWithRef<"span"> & {
  tone?: FeedbackTone | "neutral";
};

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      {...props}
      className={[styles.badge, className].filter(Boolean).join(" ")}
      data-tone={tone}
    />
  );
}

type StatePanelProps = Omit<ComponentPropsWithRef<"section">, "title"> & {
  kind: "empty" | "error";
  title: string;
  description: string;
};

export function StatePanel({
  kind,
  title,
  description,
  className,
  role,
  children,
  ...props
}: StatePanelProps) {
  return (
    <section
      {...props}
      className={[styles.statePanel, className].filter(Boolean).join(" ")}
      data-kind={kind}
      aria-label={title}
      role={role ?? (kind === "error" ? "alert" : undefined)}
    >
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </section>
  );
}
