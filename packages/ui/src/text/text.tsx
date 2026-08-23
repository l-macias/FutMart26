import type { HTMLAttributes } from "react";

export type TextVariant =
  | "display-xl"
  | "display-lg"
  | "score"
  | "heading-lg"
  | "heading-md"
  | "body"
  | "label"
  | "metadata";

export interface TextProps extends HTMLAttributes<HTMLElement> {
  as?: "h1" | "h2" | "h3" | "p" | "span";
  tone?: "primary" | "muted" | "accent";
  variant?: TextVariant;
}

export function Text({
  as: Component = "p",
  className,
  tone = "primary",
  variant = "body",
  ...props
}: TextProps) {
  const classes = [
    "ui-text",
    `ui-text--${variant}`,
    `ui-text--${tone}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <Component className={classes} {...props} />;
}
