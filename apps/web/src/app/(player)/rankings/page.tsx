import { RankingsScreen } from "@/features/rankings/rankings-screen";
import { parseRankingScope } from "@/features/rankings/rankings-navigation";

export default async function RankingsPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    scope?: string;
    groupId?: string;
    city?: string;
    venueId?: string;
  }>;
}>) {
  const query = await searchParams;
  return (
    <RankingsScreen
      cityKey={query.city}
      groupId={query.groupId}
      scope={parseRankingScope(query.scope)}
      venueId={query.venueId}
    />
  );
}
