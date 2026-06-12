import { memo, useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n";

export interface SelectOption {
  value: string;
  label: string;
  hint?: string;
}

interface SelectFieldProps {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  accent?: "cyan" | "magenta" | "amber";
  disabled?: boolean;
}

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`nifty-select-chevron ${open ? "is-open" : ""}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export const SelectField = memo(function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder,
  accent = "cyan",
  disabled = false,
}: SelectFieldProps) {
  const { t } = useI18n();
  const resolvedPlaceholder = placeholder ?? t("common.selectPlaceholder");
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  return (
    <div
      className={`nifty-select-field nifty-select-accent-${accent} ${open ? "is-open" : ""} ${disabled ? "is-disabled" : ""}`}
      ref={rootRef}
    >
      <label className="nifty-select-label">{label}</label>
      <button
        type="button"
        className="nifty-select-trigger"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="nifty-select-value">
          {selected ? (
            <>
              <span className="nifty-select-value-main">{selected.label}</span>
              {selected.hint && <span className="nifty-select-value-hint">{selected.hint}</span>}
            </>
          ) : (
            <span className="nifty-select-placeholder">{resolvedPlaceholder}</span>
          )}
        </span>
        <ChevronDown open={open} />
      </button>

      {open && (
        <div className="nifty-select-menu" role="listbox">
          {options.map((option) => (
            <button
              type="button"
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              className={`nifty-select-option ${option.value === value ? "is-selected" : ""}`}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              <span className="nifty-select-option-content">
                <span className="nifty-select-option-main">{option.label}</span>
                {option.hint && <span className="nifty-select-option-hint">{option.hint}</span>}
              </span>
              {option.value === value && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="nifty-select-check">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});