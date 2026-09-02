import { RealVotingScreen } from "@/features/voting/real-voting-screen";

export default async function MatchVotingPage({
  params,
}: Readonly<{ params: Promise<{ matchId: string }> }>) {
  return <RealVotingScreen matchId={(await params).matchId} />;
}
