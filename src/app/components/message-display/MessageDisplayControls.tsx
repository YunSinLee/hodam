import type {
  MessageDisplayControlsState,
  MessageDisplayHandlers,
} from "@/app/components/message-display/message-display-contract";

interface MessageDisplayControlsProps {
  state: MessageDisplayControlsState;
  handlers: Pick<
    MessageDisplayHandlers,
    "onToggleControls" | "onSpeedChange" | "onPitchChange"
  >;
}

export default function MessageDisplayControls({
  state,
  handlers,
}: MessageDisplayControlsProps) {
  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={handlers.onToggleControls}
        className="flex items-center mb-2 text-sm text-orange-500"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="mr-1 h-4 w-4"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
            clipRule="evenodd"
          />
        </svg>
        TTS 설정 {state.showControls ? "숨기기" : "보기"}
      </button>

      {state.showControls && (
        <div className="rounded-md bg-gray-50 p-3 text-sm">
          <div className="mb-2">
            <label className="flex items-center justify-between">
              <span>음성 속도: {state.speed.toFixed(1)}x</span>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={state.speed}
                onChange={event =>
                  handlers.onSpeedChange(Number(event.target.value))
                }
                className="ml-2 h-2 w-32 cursor-pointer appearance-none rounded-lg bg-orange-200"
              />
            </label>
          </div>
          <div>
            <label className="flex items-center justify-between">
              <span>음성 피치: {state.pitch.toFixed(1)}</span>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={state.pitch}
                onChange={event =>
                  handlers.onPitchChange(Number(event.target.value))
                }
                className="ml-2 h-2 w-32 cursor-pointer appearance-none rounded-lg bg-orange-200"
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
