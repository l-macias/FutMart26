import { ProgressionRevealScreen } from "@/features/progression-reveal/progression-reveal-screen";

export default async function MatchProgressionPage({
  params,
}: Readonly<{ params: Promise<{ matchId: string }> }>) {
  return <ProgressionRevealScreen matchId={(await params).matchId} />;
}
