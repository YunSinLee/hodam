interface AuthStatusIconProps {
  status: "loading" | "success" | "error";
}

export default function AuthStatusIcon({ status }: AuthStatusIconProps) {
  if (status === "loading") {
    return (
      <div className="h-12 w-12 rounded-full border-4 border-orange-200 border-t-orange-500 animate-spin" />
    );
  }

  if (status === "success") {
    return (
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
        <svg
          className="h-6 w-6 text-green-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>
    );
  }

  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
      <svg
        className="h-6 w-6 text-red-600"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    </div>
  );
}
