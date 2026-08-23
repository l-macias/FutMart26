import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> {
  children: ReactNode;
  label: string;
}

export function IconButton({
  children,
  className,
  label,
  type = "button",
  ...props
}: IconButtonProps) {
  const classes = ["ui-icon-button", className].filter(Boolean).join(" ");

  return (
    <button aria-label={label} className={classes} type={type} {...props}>
      {children}
    </button>
  );
}
