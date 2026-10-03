import Image from "next/image";

import styles from "./auth-visual-scene.module.css";

export function AuthVisualScene({
  compact = false,
  eyebrow,
  title,
}: Readonly<{
  compact?: boolean;
  eyebrow: string;
  title: string;
}>) {
  return (
    <section className={`${styles.scene} ${compact ? styles.compact : ""}`}>
      <div aria-hidden="true" className={styles.fieldLines} />
      <header className={styles.brand}>
        <span className={styles.brandWord}>FIFAR</span>
        <span className={styles.brandClaim}>
          Fútbol real
          <br />
          Identidad propia
        </span>
      </header>

      <div className={styles.copy}>
        <span className={styles.serial}>FIFAR / F5 / PLAYER ACCESS</span>
        <p className={styles.eyebrow}>{eyebrow}</p>
        {compact ? (
          <p className={styles.sceneTitle}>{title}</p>
        ) : (
          <h1>{title}</h1>
        )}
        {!compact ? (
          <p className={styles.intro}>
            Tu partido, tu grupo y tu carrera en una sola identidad
            futbolística.
          </p>
        ) : null}
      </div>

      <Image
        alt=""
        aria-hidden="true"
        className={styles.player}
        height={960}
        priority
        sizes="(max-width: 48rem) 72vw, 42vw"
        src="/fifar-v4/players-raster/player-portrait-01.webp"
        width={720}
      />

      <div aria-hidden="true" className={styles.competitionMark}>
        <strong>F5</strong>
        <span>ARG · 05</span>
      </div>

      {!compact ? (
        <div aria-hidden="true" className={styles.identityTrack}>
          <span>
            <b>01</b> JUGÁ
          </span>
          <span>
            <b>02</b> COMPETÍ
          </span>
          <span>
            <b>03</b> PERTENECÉ
          </span>
        </div>
      ) : null}
    </section>
  );
}
