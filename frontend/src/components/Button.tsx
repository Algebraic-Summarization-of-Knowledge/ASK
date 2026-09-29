import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
};

export default function Button({ active = false, className = "", type = "button", ...props }: Props) {
  const names = ["btn", active ? "active" : "", className].filter(Boolean).join(" ");
  return <button type={type} className={names} {...props} />;
}
