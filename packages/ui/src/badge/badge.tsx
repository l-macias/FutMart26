import type { HTMLAttributes } from "react";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  kind?: "role" | "state" | "attention";
}

export function Badge({ className, kind = "state", ...props }: BadgeProps) {
  const classes = ["ui-badge", `ui-badge--${kind}`, className]
    .filter(Boolean)
    .join(" ");

  return <span className={classes} {...props} />;
}
