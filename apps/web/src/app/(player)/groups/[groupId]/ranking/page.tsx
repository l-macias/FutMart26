import { redirect } from "next/navigation";

export default async function GroupRankingPage({
  params,
}: Readonly<{ params: Promise<{ groupId: string }> }>) {
  const { groupId } = await params;
  redirect(`/rankings?scope=group&groupId=${encodeURIComponent(groupId)}`);
}
