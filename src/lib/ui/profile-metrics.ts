export function toNumberLike(
  value: number | string | undefined | null,
): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

export function toPercentText(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
