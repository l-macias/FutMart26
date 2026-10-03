import { getPlayerCardTier } from "@/components/player-card/player-card-tier";
import styles from "./visual-v4.module.css";

function assetIndex(seed: string, count: number) {
  const value = [...seed].reduce(
    (total, character, index) => total + character.charCodeAt(0) * (index + 1),
    0,
  );
  return (value % count) + 1;
}

function assetNumber(value: number) {
  return String(value).padStart(2, "0");
}

export function V4GroupCrest({
  name,
  seed,
  size = "default",
}: Readonly<{
  name: string;
  seed: string;
  size?: "compact" | "default" | "large";
}>) {
  const file = assetNumber(assetIndex(seed, 6));
  return (
    <span
      className={`${styles.crest} ${styles[`crest${size}`]}`}
      role="img"
      aria-label={`Escudo visual de ${name}`}
    >
      <img alt="" src={`/fifar-v4/crests/crest-${file}.svg`} />
    </span>
  );
}

export function V4Portrait({
  name,
  photoSrc,
  size = "default",
}: Readonly<{
  name: string;
  photoSrc?: string | null;
  size?: "default" | "large";
}>) {
  const file = assetNumber(assetIndex(name, 4));
  return (
    <span
      className={`${styles.portrait} ${styles[`portrait${size}`]}`}
      role="img"
      aria-label={`Retrato de ${name}`}
    >
      <img
        alt=""
        src={
          photoSrc ?? `/fifar-v4/players-raster/player-portrait-${file}.webp`
        }
      />
    </span>
  );
}

export function V4RewardBadge({
  seed,
  label,
  size = "default",
}: Readonly<{
  seed: string;
  label: string;
  size?: "default" | "large";
}>) {
  const file = assetNumber(assetIndex(seed, 4));
  return (
    <span
      className={`${styles.rewardBadge} ${styles[`rewardBadge${size}`]}`}
      role="img"
      aria-label={label}
    >
      <img alt="" src={`/fifar-v4/badges/badge-${file}.svg`} />
    </span>
  );
}

export function V4TierPlate({
  overall,
  compact = false,
}: Readonly<{
  overall: number;
  compact?: boolean;
}>) {
  const tier = getPlayerCardTier(overall);
  return (
    <span
      aria-label={`${Math.round(overall)} OVR, nivel ${tier}`}
      className={`${styles.tierPlate} ${compact ? styles.tierPlateCompact : ""}`}
      data-tier={tier}
    >
      <strong>{Math.round(overall)}</strong>
      <small>OVR</small>
    </span>
  );
}
