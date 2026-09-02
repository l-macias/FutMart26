"use client";

import { useEffect, useState } from "react";

import { Text } from "@football/ui";

import styles from "./player-card.module.css";

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
}: Readonly<{
  name: string;
  overall: number;
  attributes: PlayerCardAttributes;
  footer?: string;
  photoSrc?: string | null;
}>) {
  const [photoFailed, setPhotoFailed] = useState(false);

  useEffect(() => setPhotoFailed(false), [photoSrc]);

  return (
    <figure
      aria-label={`${name}, ${Math.round(overall)} OVR, F5`}
      className={styles.playerCard}
    >
      <svg
        aria-hidden="true"
        className={styles.skinLayer}
        preserveAspectRatio="none"
        viewBox="0 0 600 900"
      >
        <path
          className={styles.skinFill}
          d="M52 20H548L590 72V828L548 880H52L10 828V72Z"
        />
        <path className={styles.pitchZone} d="M82 104H518V598H82Z" />
        <circle className={styles.pitchMark} cx="300" cy="350" r="112" />
        <path className={styles.pitchMark} d="M82 350H518M300 104V598" />
      </svg>
      <div aria-hidden="true" className={styles.artworkLayer}>
        {photoSrc && !photoFailed ? (
          // The Player name is already announced by the figure label.
          <img alt="" onError={() => setPhotoFailed(true)} src={photoSrc} />
        ) : (
          <svg
            className={styles.playerSilhouette}
            preserveAspectRatio="xMidYMax meet"
            viewBox="0 0 400 500"
          >
            <circle cx="200" cy="116" r="74" />
            <path d="M76 500V338c0-104 49-158 124-158s124 54 124 158v162Z" />
            <path d="M76 352 16 476h92M324 352l60 124h-92" />
          </svg>
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
          d="M52 20H548L590 72V828L548 880H52L10 828V72Z"
        />
        <path
          className={styles.innerFrame}
          d="M72 48H528L558 84V810L528 852H72L42 810V84Z"
        />
        <path
          className={styles.accentFrame}
          d="M42 228V84l30-36h162M558 672v138l-30 42H366"
        />
        <path className={styles.statDivider} d="M72 675H528M72 820H528" />
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
        {footer ? (
          <Text as="span" className={styles.cardFooter} variant="label">
            {footer}
          </Text>
        ) : (
          <span aria-hidden="true" />
        )}
      </div>
    </figure>
  );
}
