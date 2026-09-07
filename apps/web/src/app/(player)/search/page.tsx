import { PlayerDiscoveryScreen } from "@/features/player-discovery/player-discovery-screen";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  return <PlayerDiscoveryScreen initialQuery={q ?? ""} />;
}
