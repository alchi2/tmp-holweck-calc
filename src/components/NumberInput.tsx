export function NumberInput({
  label,
  value,
  step = 0.001,
  min,
  onChange,
  unit,
  help,
}: {
  label: string;
  value: number;
  step?: number;
  min?: number;
  onChange: (v: number) => void;
  unit?: string;
  help?: string;
}) {
  return (
    <label className="num-input" title={help}>
      <span className="num-label">
        {label}
        {unit ? <span className="num-unit"> [{unit}]</span> : null}
      </span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        step={step}
        min={min}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </label>
  );
}
