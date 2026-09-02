import { RealMatchScreen } from "@/features/matches/real-match-screen";

export default async function MatchPage({
  params,
}: Readonly<{ params: Promise<{ matchId: string }> }>) {
  return <RealMatchScreen matchId={(await params).matchId} />;
}
