import { MatchEditScreen } from "@/features/matches/match-edit-screen";

export default async function MatchEditPage({
  params,
}: Readonly<{ params: Promise<{ matchId: string }> }>) {
  return <MatchEditScreen matchId={(await params).matchId} />;
}
