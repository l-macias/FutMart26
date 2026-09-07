import type { OwnPlayerProfile, PlayerImage } from "@football/contracts";

import { PlayerCard } from "@/components/player-card/player-card";
import { mediaContentUrl } from "@/lib/api/client";
type Performance = OwnPlayerProfile["performance"];

export function ProfilePlayerCard({
  name,
  performance,
  image,
}: Readonly<{
  name: string;
  performance: Performance;
  image: PlayerImage | null;
}>) {
  return (
    <PlayerCard
      {...performance}
      footer={performance.ratingProfile}
      name={name}
      photoSrc={image ? mediaContentUrl(image.url) : null}
    />
  );
}
