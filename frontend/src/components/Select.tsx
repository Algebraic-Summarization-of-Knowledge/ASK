import { useEffect, useId, useRef, useState } from "react";

type Option = { value: string; label: string };

export default function Select({
  label,
  value,
  placeholder,
  options,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  const current = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={open ? "field open" : "field"} ref={root}>
      <span className="field-label" id={`${listId}-label`}>
        {label}
      </span>
      <button
        type="button"
        className={open ? "select open" : "select"}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${listId}-label ${listId}-value`}
        onClick={() => setOpen((next) => !next)}
      >
        <span id={`${listId}-value`}>{current?.label ?? placeholder}</span>
        <span className={open ? "chevron up" : "chevron"} />
      </button>
      {open && (
        <ul className="menu" id={listId} role="listbox" aria-label={label}>
          {options.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
