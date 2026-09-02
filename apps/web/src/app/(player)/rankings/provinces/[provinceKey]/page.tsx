import { TerritorialRankingScreen } from "@/features/territorial-ranking/territorial-ranking-screen";

export default async function ProvinceRankingPage({
  params,
}: Readonly<{ params: Promise<{ provinceKey: string }> }>) {
  return (
    <TerritorialRankingScreen
      scopeId={(await params).provinceKey}
      type="PROVINCE"
    />
  );
}
