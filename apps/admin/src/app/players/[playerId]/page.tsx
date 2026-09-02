import { ResourceScreen } from "../../../components/resource-screen";
export default async function Page({
  params,
}: Readonly<{ params: Promise<{ playerId: string }> }>) {
  return <ResourceScreen kind="players" id={(await params).playerId} />;
}
