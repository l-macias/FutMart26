import { TerritorialRankingScreen } from "@/features/territorial-ranking/territorial-ranking-screen";

export default async function CountryRankingPage({
  params,
}: Readonly<{ params: Promise<{ countryKey: string }> }>) {
  return (
    <TerritorialRankingScreen
      scopeId={(await params).countryKey}
      type="COUNTRY"
    />
  );
}
