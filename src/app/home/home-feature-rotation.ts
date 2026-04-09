export const HOME_FEATURE_ROTATION_INTERVAL_MS = 3000;

export function getNextFeatureIndex(
  currentIndex: number,
  featureCount: number,
): number {
  if (!Number.isFinite(featureCount) || featureCount <= 0) {
    return 0;
  }

  const normalizedCurrent = Number.isFinite(currentIndex) ? currentIndex : 0;
  return (normalizedCurrent + 1) % featureCount;
}
