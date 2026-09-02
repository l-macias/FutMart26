import { InvitationScreen } from "@/features/invitations/invitation-screen";

export default async function InvitationPage({
  params,
}: Readonly<{ params: Promise<{ token: string }> }>) {
  return <InvitationScreen token={(await params).token} />;
}
