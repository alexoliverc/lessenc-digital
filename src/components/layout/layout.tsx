import type { ComponentPropsWithRef } from "react";

import styles from "./layout.module.css";

type ContainerProps = ComponentPropsWithRef<"div"> & {
  size?: "narrow" | "standard" | "wide";
};

export function Container({ size = "standard", className, ...props }: ContainerProps) {
  return (
    <div
      {...props}
      className={[styles.container, className].filter(Boolean).join(" ")}
      data-size={size}
    />
  );
}

type SectionProps = ComponentPropsWithRef<"section"> & {
  tone?: "base" | "muted";
};

export function Section({ tone = "base", className, ...props }: SectionProps) {
  return (
    <section
      {...props}
      className={[styles.section, className].filter(Boolean).join(" ")}
      data-tone={tone}
    />
  );
}

type StackProps = ComponentPropsWithRef<"div"> & {
  gap?: "small" | "medium" | "large";
};

export function Stack({ gap = "medium", className, ...props }: StackProps) {
  return (
    <div
      {...props}
      className={[styles.stack, className].filter(Boolean).join(" ")}
      data-gap={gap}
    />
  );
}

type InlineProps = ComponentPropsWithRef<"div"> & {
  gap?: "small" | "medium" | "large";
  align?: "start" | "center" | "end";
};

export function Inline({ gap = "medium", align = "center", className, ...props }: InlineProps) {
  return (
    <div
      {...props}
      className={[styles.inline, className].filter(Boolean).join(" ")}
      data-gap={gap}
      data-align={align}
    />
  );
}

type GridProps = ComponentPropsWithRef<"div"> & {
  columns?: 2 | 3;
};

export function Grid({ columns = 3, className, ...props }: GridProps) {
  return (
    <div
      {...props}
      className={[styles.grid, className].filter(Boolean).join(" ")}
      data-columns={columns}
    />
  );
}
