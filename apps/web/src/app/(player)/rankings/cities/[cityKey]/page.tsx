import { TerritorialRankingScreen } from "@/features/territorial-ranking/territorial-ranking-screen";

export default async function CityRankingPage({
  params,
}: Readonly<{ params: Promise<{ cityKey: string }> }>) {
  return (
    <TerritorialRankingScreen scopeId={(await params).cityKey} type="CITY" />
  );
}
