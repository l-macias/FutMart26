import { GroupDetailScreen } from "@/features/groups/group-detail-screen";

export default async function GroupDetailPage({
  params,
}: Readonly<{ params: Promise<{ groupId: string }> }>) {
  return <GroupDetailScreen groupId={(await params).groupId} />;
}
