import { redirect } from "next/navigation";

export default async function VenueRankingPage({
  params,
}: Readonly<{ params: Promise<{ venueId: string }> }>) {
  const { venueId } = await params;
  redirect(`/rankings?scope=venue&venueId=${encodeURIComponent(venueId)}`);
}
