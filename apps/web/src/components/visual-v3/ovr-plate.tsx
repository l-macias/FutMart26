import styles from "./visual-v3.module.css";

export function OvrPlate({
  value,
  label = "OVR",
  detail,
  size = "default",
}: Readonly<{
  value: number | string;
  label?: string;
  detail?: string;
  size?: "compact" | "default" | "large";
}>) {
  return (
    <div
      aria-label={`${value} ${label}${detail ? `, ${detail}` : ""}`}
      className={`${styles.ovrPlate} ${styles[`ovrPlate${size}`]}`}
    >
      <span className={styles.ovrValue}>{value}</span>
      <span className={styles.ovrLabel}>{label}</span>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}
