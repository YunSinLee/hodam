import React, { ReactNode, MouseEvent } from "react";

type ButtonSize = "xs" | "sm" | "md" | "lg" | "xl";
type ButtonColor = "orange" | "blue" | "green" | "red" | "neutral";
type ButtonStyle = "filled" | "outlined";

interface HButtonProps {
  className?: string;
  label?: string;
  children?: ReactNode;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  size?: ButtonSize;
  color?: ButtonColor;
  style?: ButtonStyle;
  disabled?: boolean;
}

export default function HButton({
  className,
  label,
  children,
  onClick,
  size = "md",
  color = "orange",
  style = "filled",
  disabled = false,
}: HButtonProps) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (onClick) {
      onClick(event);
    }
  };

  const basicClass = "text-left leading-8 border rounded-md shadow";
  const sizeClass = `text-${size} ${size === "xs" || size === "sm" ? "px-2 py-0" : "px-4 py-2"}`;
  const styleClass =
    style === "filled"
      ? `bg-${color}-500 border-transparent hover:bg-${color}-600 text-white focus:outline-none focus:bg-${color}-700`
      : `border border-${color}-500 hover:bg-${color}-100 hover:border-${color}-100 focus:bg-${color}-200 focus:border-${color}-200 text-${color}-500`;
  const disabledClass = disabled ? "opacity-50 cursor-not-allowed" : "";

  const buttonClass = `${basicClass} ${sizeClass} ${styleClass} ${disabledClass} ${className}`;

  return (
    <button className={buttonClass} onClick={handleClick} disabled={disabled}>
      {children ? children : label}
    </button>
  );
}
