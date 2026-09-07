export const rankingScopes = ["global", "group", "city", "venue"] as const;
export type RankingScope = (typeof rankingScopes)[number];

export function parseRankingScope(value?: string): RankingScope {
  return rankingScopes.includes(value as RankingScope)
    ? (value as RankingScope)
    : "global";
}

export function rankingHref(
  scope: RankingScope,
  context?: { groupId?: string; cityKey?: string; venueId?: string },
) {
  const query = new URLSearchParams({ scope });
  if (scope === "group" && context?.groupId)
    query.set("groupId", context.groupId);
  if (scope === "city" && context?.cityKey) query.set("city", context.cityKey);
  if (scope === "venue" && context?.venueId)
    query.set("venueId", context.venueId);
  return `/rankings?${query.toString()}`;
}
