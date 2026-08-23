import type { HTMLAttributes } from "react";

export interface SurfaceProps extends HTMLAttributes<HTMLElement> {
  as?: "article" | "aside" | "div" | "section";
  elevation?: "base" | "raised";
}

export function Surface({
  as: Component = "div",
  className,
  elevation = "base",
  ...props
}: SurfaceProps) {
  const classes = ["ui-surface", `ui-surface--${elevation}`, className]
    .filter(Boolean)
    .join(" ");

  return <Component className={classes} {...props} />;
}
