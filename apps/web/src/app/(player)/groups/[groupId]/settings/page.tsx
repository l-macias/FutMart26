import { GroupSettingsScreen } from "@/features/group-settings/group-settings-screen";

export default async function GroupSettingsPage({
  params,
}: Readonly<{ params: Promise<{ groupId: string }> }>) {
  return <GroupSettingsScreen groupId={(await params).groupId} />;
}
