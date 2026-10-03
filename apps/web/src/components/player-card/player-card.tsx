"use client";

import { useEffect, useState } from "react";

import { Text } from "@football/ui";

import styles from "./player-card.module.css";
import { getPlayerCardTier, type PlayerCardTier } from "./player-card-tier";

export type { PlayerCardTier } from "./player-card-tier";

export type PlayerCardAttributes = Readonly<{
  VELOCIDAD: number;
  PASE: number;
  REGATE: number;
  REMATE: number;
  DEFENSA: number;
  FISICO: number;
}>;

const attributeLabels = {
  VELOCIDAD: "VEL",
  PASE: "PAS",
  REGATE: "REG",
  REMATE: "REM",
  DEFENSA: "DEF",
  FISICO: "FIS",
} as const;

export function PlayerCard({
  name,
  overall,
  attributes,
  footer,
  photoSrc,
  visualTier,
  displaySize = "profile",
}: Readonly<{
  name: string;
  overall: number;
  attributes: PlayerCardAttributes;
  footer?: string;
  photoSrc?: string | null;
  visualTier?: PlayerCardTier;
  displaySize?: "profile" | "showcase";
}>) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const placeholderNumber = String(playerAssetIndex(name, 4)).padStart(2, "0");
  const tier = visualTier ?? getPlayerCardTier(overall);

  useEffect(() => setPhotoFailed(false), [photoSrc]);

  return (
    <figure
      aria-label={`${name}, ${Math.round(overall)} OVR, F5`}
      className={styles.playerCard}
      data-size={displaySize}
      data-tier={tier}
    >
      <svg
        aria-hidden="true"
        className={styles.skinLayer}
        preserveAspectRatio="none"
        viewBox="0 0 600 900"
      >
        <path
          className={styles.skinFill}
          d="M24 28H454L576 142V736L492 872H118L24 790Z"
        />
        <path className={styles.pitchZone} d="M56 82H466L544 156V594H56Z" />
        <circle className={styles.pitchMark} cx="302" cy="340" r="104" />
        <path
          className={styles.pitchMark}
          d="M56 340H544M302 82V594M56 176h88v328H56"
        />
      </svg>
      <img
        alt=""
        aria-hidden="true"
        className={styles.shellLayer}
        src={`/fifar-v4/cards/${tier}.webp`}
      />
      <div aria-hidden="true" className={styles.artworkLayer}>
        {photoSrc && !photoFailed ? (
          // The Player name is already announced by the figure label.
          <img alt="" onError={() => setPhotoFailed(true)} src={photoSrc} />
        ) : (
          <img
            alt=""
            className={styles.playerSilhouette}
            src={`/fifar-v4/players-raster/player-portrait-${placeholderNumber}.webp`}
          />
        )}
      </div>
      <svg
        aria-hidden="true"
        className={styles.frameLayer}
        preserveAspectRatio="none"
        viewBox="0 0 600 900"
      >
        <path
          className={styles.outerFrame}
          d="M24 28H454L576 142V736L492 872H118L24 790Z"
        />
        <path
          className={styles.innerFrame}
          d="M52 56H442L546 154V726L476 842H130L52 778Z"
        />
        <path
          className={styles.accentFrame}
          d="M24 268V28h260M576 482v254l-84 136H328"
        />
        <path className={styles.statDivider} d="M52 650H530M72 812H510" />
      </svg>
      <div className={styles.dataLayer}>
        <header className={styles.cardTop}>
          <span>
            <Text as="span" className={styles.cardOverall} variant="score">
              {Math.round(overall)}
            </Text>
            <Text as="span" variant="metadata">
              OVR
            </Text>
          </span>
          <Text
            as="span"
            className={styles.cardDiscipline}
            variant="heading-md"
          >
            F5
          </Text>
        </header>
        <span aria-hidden="true" className={styles.cardSerial}>
          PLAYER / {placeholderNumber}
        </span>
        <div aria-hidden="true" />
        <Text as="span" className={styles.cardName} variant="display-lg">
          {name}
        </Text>
        <dl className={styles.cardStats}>
          {Object.entries(attributes).map(([attribute, value]) => (
            <div key={attribute}>
              <dt>
                {attributeLabels[attribute as keyof typeof attributeLabels]}
              </dt>
              <dd>{Math.round(value)}</dd>
            </div>
          ))}
        </dl>
        <span className={styles.cardFootline}>
          <Text as="span" className={styles.cardBrand} variant="label">
            FIFAR
          </Text>
          {footer ? (
            <Text as="span" className={styles.cardFooter} variant="label">
              {footer}
            </Text>
          ) : null}
        </span>
      </div>
    </figure>
  );
}

function playerAssetIndex(seed: string, assetCount: number) {
  return (
    ([...seed].reduce(
      (total, character, index) =>
        total + character.charCodeAt(0) * (index + 1),
      0,
    ) %
      assetCount) +
    1
  );
}
