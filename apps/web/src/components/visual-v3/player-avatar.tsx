import styles from "./visual-v3.module.css";

export function PlayerAvatar({
  name,
  photoSrc,
  size = "default",
}: Readonly<{
  name: string;
  photoSrc?: string | null;
  size?: "compact" | "default" | "large";
}>) {
  return (
    <span
      aria-label={photoSrc ? `Foto de ${name}` : `Silueta de ${name}`}
      className={`${styles.avatar} ${styles[`avatar${size}`]}`}
      role="img"
    >
      {photoSrc ? (
        // The wrapper provides the accessible label.
        <img alt="" src={photoSrc} />
      ) : (
        <svg aria-hidden="true" viewBox="0 0 64 72">
          <path
            className={styles.avatarLight}
            d="M32 8c10 0 17 8 17 18S42 44 32 44 15 36 15 26 22 8 32 8Z"
          />
          <path
            className={styles.avatarBody}
            d="M5 72c1-19 10-29 27-29s26 10 27 29Z"
          />
          <path
            className={styles.avatarCut}
            d="m4 58 18-9 13 23H4ZM60 55 42 47 31 72h29Z"
          />
        </svg>
      )}
    </span>
  );
}
