interface BeadCenteredStateProps {
  title?: string;
  message: string;
  loading?: boolean;
}

export default function BeadCenteredState({
  title,
  message,
  loading = false,
}: BeadCenteredStateProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        {loading && (
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-orange-200 border-t-orange-500" />
        )}
        {title && (
          <h2 className="mb-3 text-2xl font-bold text-gray-800">{title}</h2>
        )}
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  );
}
