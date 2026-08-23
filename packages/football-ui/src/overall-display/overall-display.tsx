export interface OverallDisplayProps {
  label?: string;
  value: number | string;
}

export function OverallDisplay({ label = "OVR", value }: OverallDisplayProps) {
  return (
    <div className="football-overall" aria-label={`${label}: ${value}`}>
      <span aria-hidden="true" className="football-overall__value">
        {value}
      </span>
      <span aria-hidden="true" className="football-overall__label">
        {label}
      </span>
    </div>
  );
}
