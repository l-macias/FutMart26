import type { ReactNode } from "react";

export interface MatchStateMarkProps {
  children: ReactNode;
  tone?: "neutral" | "positive" | "warning" | "negative";
}

export function MatchStateMark({
  children,
  tone = "neutral",
}: MatchStateMarkProps) {
  return (
    <span className={`football-state football-state--${tone}`}>
      <span aria-hidden="true" className="football-state__signal" />
      {children}
    </span>
  );
}
