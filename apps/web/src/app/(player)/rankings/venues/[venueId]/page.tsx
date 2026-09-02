import { TerritorialRankingScreen } from "@/features/territorial-ranking/territorial-ranking-screen";

export default async function VenueRankingPage({
  params,
}: Readonly<{ params: Promise<{ venueId: string }> }>) {
  return (
    <TerritorialRankingScreen scopeId={(await params).venueId} type="VENUE" />
  );
}
