import { ResourceScreen } from "../../../components/resource-screen";
export default async function Page({
  params,
}: Readonly<{ params: Promise<{ groupId: string }> }>) {
  return <ResourceScreen kind="groups" id={(await params).groupId} />;
}
