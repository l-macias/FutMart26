import type { ButtonHTMLAttributes } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "quiet";
}

export function Button({
  className,
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  const classes = ["ui-button", `ui-button--${variant}`, className]
    .filter(Boolean)
    .join(" ");

  return <button className={classes} type={type} {...props} />;
}
