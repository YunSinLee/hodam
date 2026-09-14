interface MessageDisplayLineItemProps {
  text: string;
  isPlaying: boolean;
  onClick: () => void;
  variant: "ko" | "en";
}

export default function MessageDisplayLineItem({
  text,
  isPlaying,
  onClick,
  variant,
}: MessageDisplayLineItemProps) {
  const isEnglish = variant === "en";
  const borderClass = isEnglish ? "border-blue-400" : "border-orange-500";
  const textClass = isEnglish ? "text-gray-600 italic" : "text-gray-800";
  const hoverClass = isEnglish
    ? "hover:bg-blue-50/50"
    : "hover:bg-orange-50/50";
  const activeBgClass = isEnglish ? "bg-blue-50" : "bg-orange-50";
  const iconColorClass = isEnglish ? "text-blue-400" : "text-orange-500";
  const waveBarClass = isEnglish ? "bg-blue-400" : "bg-orange-500";

  return (
    <div className="relative group" onClick={onClick}>
      <p
        className={`flex items-center rounded-r py-2 px-3 transition-all cursor-pointer border-l-4 ${borderClass} ${textClass} ${
          isPlaying ? activeBgClass : hoverClass
        }`}
      >
        <span className="relative mr-2 inline-block h-5 w-5 flex-shrink-0">
          {isPlaying ? (
            <span className="absolute inset-0 h-3 w-3">
              <span
                className={`absolute h-3 w-1 rounded-sm ${waveBarClass} animate-sound-wave1`}
              />
              <span
                className={`absolute left-1 h-3 w-1 rounded-sm ${waveBarClass} animate-sound-wave2`}
              />
              <span
                className={`absolute left-2 h-3 w-1 rounded-sm ${waveBarClass} animate-sound-wave3`}
              />
            </span>
          ) : (
            <span
              className={`absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100 ${iconColorClass}`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
          )}
        </span>
        <span className="inline-block">{text}</span>
      </p>
    </div>
  );
}
