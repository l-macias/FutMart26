import type { CSSProperties } from "react";

import type { PlayerCardAttributes } from "@/components/player-card/player-card";

import styles from "./visual-v4.module.css";

const roleLabels: Record<string, string> = {
  LIBRE: "Libre",
  DEFENSIVO: "Defensivo",
  MEDIO: "Medio",
  OFENSIVO: "Ofensivo",
  PORTERO: "Portero",
};

const roleMarks: Record<string, string> = {
  LIBRE: "LIB",
  DEFENSIVO: "DEF",
  MEDIO: "MED",
  OFENSIVO: "OFE",
  PORTERO: "POR",
};

const attributeLabels: Record<keyof PlayerCardAttributes, string> = {
  VELOCIDAD: "VEL",
  PASE: "PAS",
  REGATE: "REG",
  REMATE: "REM",
  DEFENSA: "DEF",
  FISICO: "FIS",
};

export function V4PlayIdentity({
  roles,
  strengths,
  willingToPlayGoalkeeper,
  attributes,
}: Readonly<{
  roles: readonly string[];
  strengths: readonly string[];
  willingToPlayGoalkeeper: boolean;
  attributes: PlayerCardAttributes;
}>) {
  const visibleRoles = roles.length > 0 ? roles.slice(0, 2) : ["LIBRE"];
  const keyAttributes = (
    Object.entries(attributes) as [keyof PlayerCardAttributes, number][]
  )
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3);

  return (
    <div className={styles.playIdentity}>
      <div
        aria-label={`Posición principal: ${visibleRoles.map(roleLabel).join(" y ")}`}
        className={styles.miniPitch}
        role="img"
      >
        <span className={styles.pitchHalfway} aria-hidden="true" />
        <span className={styles.pitchCircle} aria-hidden="true" />
        <span className={styles.pitchAreaTop} aria-hidden="true" />
        <span className={styles.pitchAreaBottom} aria-hidden="true" />
        {visibleRoles.map((role, index) => (
          <span
            className={`${styles.positionMarker} ${styles[`position${role}`] ?? styles.positionLIBRE}`}
            key={role}
            style={{ "--marker-offset": index } as CSSProperties}
          >
            {roleMarks[role] ?? role.slice(0, 3)}
          </span>
        ))}
      </div>
      <div className={styles.playIdentityData}>
        <span>IDENTIDAD TÁCTICA</span>
        <strong>{visibleRoles.map(roleLabel).join(" · ")}</strong>
        <small>
          {strengths.length > 0
            ? strengths.join(" · ")
            : willingToPlayGoalkeeper
              ? "Disponible como portero"
              : "Perfil F5 en desarrollo"}
        </small>
        <dl className={styles.keyAttributes}>
          {keyAttributes.map(([attribute, value]) => (
            <div key={attribute}>
              <dt>{attributeLabels[attribute]}</dt>
              <dd>{Math.round(value)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

function roleLabel(role: string) {
  return roleLabels[role] ?? role;
}
