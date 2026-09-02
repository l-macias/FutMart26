import { RealMatchmakingScreen } from "@/features/matches/real-matchmaking-screen";

export default async function MatchTeamsPage({
  params,
}: Readonly<{ params: Promise<{ matchId: string }> }>) {
  return <RealMatchmakingScreen matchId={(await params).matchId} />;
}
