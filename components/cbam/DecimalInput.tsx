import { normalizeUnsignedDecimalInput } from "@/lib/cbam/decimal-input";

interface DecimalInputProps {
  ariaLabel: string;
  value: string | number;
  onValueChange: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  className?: string;
}

export function DecimalInput({
  ariaLabel,
  value,
  onValueChange,
  min,
  max,
  placeholder,
  className = "w-full rounded border border-border bg-background p-2 text-sm",
}: DecimalInputProps) {
  const numericValue = value === "" ? null : Number(value);
  const belowMinimum = numericValue !== null && min !== undefined && numericValue < Number(min);
  const aboveMaximum = numericValue !== null && max !== undefined && numericValue > Number(max);

  return (
    <input
      aria-label={ariaLabel}
      aria-invalid={belowMinimum || aboveMaximum}
      type="text"
      inputMode="decimal"
      pattern="[0-9]*[.,]?[0-9]*"
      placeholder={placeholder}
      value={value}
      onChange={(event) => {
        const normalized = normalizeUnsignedDecimalInput(event.target.value);
        if (normalized !== null) onValueChange(normalized);
      }}
      className={className}
    />
  );
}
