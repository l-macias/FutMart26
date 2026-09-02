import { ResourceScreen } from "../../../components/resource-screen";
export default async function Page({
  params,
}: Readonly<{ params: Promise<{ matchId: string }> }>) {
  return <ResourceScreen kind="matches" id={(await params).matchId} />;
}
