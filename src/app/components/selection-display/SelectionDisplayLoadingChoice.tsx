interface SelectionDisplayLoadingChoiceProps {
  selectedChoice: string;
}

export default function SelectionDisplayLoadingChoice({
  selectedChoice,
}: SelectionDisplayLoadingChoiceProps) {
  return (
    <div className="rounded-xl border border-orange-400 bg-orange-100 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-orange-500 text-sm font-bold text-white">
          ✓
        </div>
        <div className="flex-1">
          <p className="font-medium text-orange-800">{selectedChoice}</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
            <p className="text-sm text-orange-600">
              이야기를 생성하고 있습니다...
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
