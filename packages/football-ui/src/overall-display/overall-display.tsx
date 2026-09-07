export interface OverallDisplayProps {
  label?: string;
  size?: "compact" | "default" | "feature";
  value: number | string;
}

export function OverallDisplay({
  label = "OVR",
  size = "default",
  value,
}: OverallDisplayProps) {
  return (
    <div
      className={`football-overall football-overall--${size}`}
      aria-label={`${label}: ${value}`}
    >
      <span aria-hidden="true" className="football-overall__value">
        {value}
      </span>
      <span aria-hidden="true" className="football-overall__label">
        {label}
      </span>
    </div>
  );
}
