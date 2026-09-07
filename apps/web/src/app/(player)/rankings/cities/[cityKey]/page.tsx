import { redirect } from "next/navigation";

export default async function CityRankingPage({
  params,
}: Readonly<{ params: Promise<{ cityKey: string }> }>) {
  const { cityKey } = await params;
  redirect(`/rankings?scope=city&city=${encodeURIComponent(cityKey)}`);
}
