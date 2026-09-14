interface NavMenuToggleButtonProps {
  isOpen: boolean;
  onToggle: () => void;
}

export default function NavMenuToggleButton({
  isOpen,
  onToggle,
}: NavMenuToggleButtonProps) {
  return (
    <button
      type="button"
      className="lg:hidden p-2 rounded-full hover:bg-gray-100 transition-colors duration-200"
      onClick={onToggle}
      aria-label={isOpen ? "메뉴 닫기" : "메뉴 열기"}
      aria-expanded={isOpen}
      aria-controls="mobile-nav-menu"
    >
      <div className="w-6 h-6 flex flex-col justify-center items-center">
        <div
          className={`w-5 h-0.5 bg-gray-600 transition-all duration-300 ${
            isOpen ? "rotate-45 translate-y-1.5" : ""
          }`}
        />
        <div
          className={`w-5 h-0.5 bg-gray-600 my-1 transition-all duration-300 ${
            isOpen ? "opacity-0" : ""
          }`}
        />
        <div
          className={`w-5 h-0.5 bg-gray-600 transition-all duration-300 ${
            isOpen ? "-rotate-45 -translate-y-1.5" : ""
          }`}
        />
      </div>
    </button>
  );
}
