import type { ComponentPropsWithRef } from "react";

import styles from "./surface.module.css";

type SurfaceProps = ComponentPropsWithRef<"div"> & {
  elevation?: "flat" | "raised";
  padding?: "regular" | "spacious";
};

export function Surface({
  elevation = "flat",
  padding = "regular",
  className,
  ...props
}: SurfaceProps) {
  return (
    <div
      {...props}
      className={[styles.surface, className].filter(Boolean).join(" ")}
      data-elevation={elevation}
      data-padding={padding}
    />
  );
}
