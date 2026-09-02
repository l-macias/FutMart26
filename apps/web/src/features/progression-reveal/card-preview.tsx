import { PlayerCard } from "@/components/player-card/player-card";

export function CardPreview() {
  return (
    <PlayerCard
      attributes={{
        VELOCIDAD: 80,
        PASE: 72,
        REGATE: 76,
        REMATE: 73,
        DEFENSA: 62,
        FISICO: 69,
      }}
      footer="Preview mock"
      name="Lucas"
      overall={71}
    />
  );
}
