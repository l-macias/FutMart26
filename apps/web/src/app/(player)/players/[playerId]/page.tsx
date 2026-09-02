import { PublicPlayerProfileScreen } from "@/features/public-player-profile/public-player-profile-screen";

export default async function PublicPlayerPage({
  params,
}: Readonly<{ params: Promise<{ playerId: string }> }>) {
  const { playerId } = await params;
  return <PublicPlayerProfileScreen playerId={playerId} />;
}
