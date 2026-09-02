import { MatchCompletionScreen } from "@/features/matches/match-completion-screen";

export default async function MatchClosePage({
  params,
}: Readonly<{ params: Promise<{ matchId: string }> }>) {
  return <MatchCompletionScreen matchId={(await params).matchId} />;
}
