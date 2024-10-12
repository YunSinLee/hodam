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
  buttonStyle?: ButtonStyle;
  disabled?: boolean;
}

// Size classes mapping
const sizeClasses = {
  xs: "text-xs px-2 py-1",
  sm: "text-sm px-3 py-1.5",
  md: "text-md px-4 py-2",
  lg: "text-lg px-5 py-2.5",
  xl: "text-xl px-6 py-3",
};

// Color classes mapping for filled style
const filledColorClasses = {
  orange:
    "bg-orange-500 hover:bg-orange-600 focus:bg-orange-700 border-transparent text-white",
  blue: "bg-blue-500 hover:bg-blue-600 focus:bg-blue-700 border-transparent text-white",
  green:
    "bg-green-500 hover:bg-green-600 focus:bg-green-700 border-transparent text-white",
  red: "bg-red-500 hover:bg-red-600 focus:bg-red-700 border-transparent text-white",
  neutral:
    "bg-gray-500 hover:bg-gray-600 focus:bg-gray-700 border-transparent text-white",
};

// Color classes mapping for outlined style
const outlinedColorClasses = {
  orange:
    "border border-orange-500 hover:bg-orange-100 hover:border-orange-100 focus:bg-orange-200 focus:border-orange-200 text-orange-500",
  blue: "border border-blue-500 hover:bg-blue-100 hover:border-blue-100 focus:bg-blue-200 focus:border-blue-200 text-blue-500",
  green:
    "border border-green-500 hover:bg-green-100 hover:border-green-100 focus:bg-green-200 focus:border-green-200 text-green-500",
  red: "border border-red-500 hover:bg-red-100 hover:border-red-100 focus:bg-red-200 focus:border-red-200 text-red-500",
  neutral:
    "border border-gray-500 hover:bg-gray-100 hover:border-gray-100 focus:bg-gray-200 focus:border-gray-200 text-gray-500",
};

export default function HButton({
  className,
  label,
  children,
  onClick,
  size = "md",
  color = "orange",
  buttonStyle = "filled",
  disabled = false,
}: HButtonProps) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (onClick) {
      onClick(event);
    }
  };

  const basicClass = "text-left leading-8 rounded-md shadow focus:outline-none";
  const sizeClass = sizeClasses[size];
  const styleClass =
    buttonStyle === "filled"
      ? filledColorClasses[color]
      : outlinedColorClasses[color];
  const disabledClass = disabled ? "opacity-50 cursor-not-allowed" : "";

  const buttonClass = `${basicClass} ${sizeClass} ${styleClass} ${disabledClass} ${className || ""}`;

  return (
    <button
      type="button"
      className={buttonClass}
      onClick={handleClick}
      disabled={disabled}
    >
      {children || label}
    </button>
  );
}

HButton.defaultProps = {
  className: "",
  label: "",
  children: null,
  onClick: undefined,
  size: "md",
  color: "orange",
  buttonStyle: "filled",
  disabled: false,
};
