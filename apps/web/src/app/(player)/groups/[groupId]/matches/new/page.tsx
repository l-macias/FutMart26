import { MatchCreationScreen } from "@/features/matches/match-creation-screen";

export default async function CreateMatchPage({
  params,
}: Readonly<{ params: Promise<{ groupId: string }> }>) {
  return <MatchCreationScreen groupId={(await params).groupId} />;
}
