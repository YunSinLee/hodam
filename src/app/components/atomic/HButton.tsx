import React, { ReactNode, MouseEvent } from "react";

type ButtonSize = "xs" | "sm" | "md" | "lg" | "xl";
type ButtonColor = "orange" | "blue" | "green" | "red";
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

  const basicClass = "text-left leading-8 px-4 py-2 border rounded-md shadow";
  const sizeClass = `text-${size}`;
  const styleClass =
    style === "filled"
      ? `bg-${color}-500 border-transparent hover:bg-${color}-700 text-white focus:outline-none focus:ring-2 focus:ring-${color}-500 focus:ring-offset-2`
      : `border border-${color}-500 hover:bg-${color}-100 hover:border-${color}-100 text-${color}-500`;
  const disabledClass = disabled ? "opacity-50 cursor-not-allowed" : "";

  const buttonClass = `${basicClass} ${sizeClass} ${styleClass} ${disabledClass} ${className}`;

  return (
    <button className={buttonClass} onClick={handleClick} disabled={disabled}>
      {children ? children : label}
    </button>
  );
}
