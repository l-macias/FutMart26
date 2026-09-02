import { GroupRankingScreen } from "@/features/group-ranking/group-ranking-screen";

export default async function GroupRankingPage({
  params,
}: Readonly<{ params: Promise<{ groupId: string }> }>) {
  return <GroupRankingScreen groupId={(await params).groupId} />;
}
