import { useState, type ReactNode } from "react";
import Button from "./Button";

type MenuItem = { id: string; label: string };
type Option<T extends string> = { id: T; label: ReactNode; menu?: MenuItem[] };

function Flyout<T extends string>({
  option,
  active,
  menuValue,
  onChange,
  onMenu,
}: {
  option: Option<T>;
  active: boolean;
  menuValue?: string;
  onChange: (id: T) => void;
  onMenu?: (id: T, item: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flyout" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <Button
        active={active}
        role="tab"
        aria-selected={active}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => {
          onChange(option.id);
          setOpen(true);
        }}
      >
        {option.label}
      </Button>
      {open && (
        <div className="flyout-menu" role="menu">
          {option.menu?.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className={active && menuValue === item.id ? "active" : ""}
              onClick={() => {
                onChange(option.id);
                onMenu?.(option.id, item.id);
                setOpen(false);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ButtonBar<T extends string>({
  value,
  menuValue,
  options,
  onChange,
  onMenu,
}: {
  value: T;
  menuValue?: string;
  options: Option<T>[];
  onChange: (id: T) => void;
  onMenu?: (id: T, item: string) => void;
}) {
  return (
    <div className="bar" role="tablist">
      {options.map((option) =>
        option.menu ? (
          <Flyout
            key={option.id}
            option={option}
            active={option.id === value}
            menuValue={menuValue}
            onChange={onChange}
            onMenu={onMenu}
          />
        ) : (
          <Button
            key={option.id}
            active={option.id === value}
            role="tab"
            aria-selected={option.id === value}
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </Button>
        ),
      )}
    </div>
  );
}
