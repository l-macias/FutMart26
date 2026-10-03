export type PlayerCardTier = "bronze" | "silver" | "gold" | "elite" | "legend";

export function getPlayerCardTier(overall: number): PlayerCardTier {
  if (overall >= 90) return "legend";
  if (overall >= 80) return "elite";
  if (overall >= 70) return "gold";
  if (overall >= 60) return "silver";
  return "bronze";
}
