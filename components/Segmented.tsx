'use client';

interface Props<T extends string | number> {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

/** A row of choices where exactly one is picked. */
export function Segmented<T extends string | number>({ label, options, value, onChange }: Props<T>) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={`segment${o.value === value ? ' is-on' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

interface ToggleProps {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** An on/off switch with its label. */
export function Toggle({ label, hint, checked, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className="toggle"
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-text">
        <span>{label}</span>
        {hint && <span className="hint">{hint}</span>}
      </span>
      <span className={`toggle-track${checked ? ' is-on' : ''}`} aria-hidden="true">
        <span className="toggle-thumb" />
      </span>
    </button>
  );
}
