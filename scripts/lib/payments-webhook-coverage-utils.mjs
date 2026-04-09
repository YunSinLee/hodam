export function parsePositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

export function isWithinLookback(
  value,
  lookbackMinutes,
  nowMs = Date.now(),
) {
  if (!Number.isFinite(lookbackMinutes) || lookbackMinutes <= 0) return true;
  const parsed = Date.parse(value || "");
  if (Number.isNaN(parsed)) return false;
  const threshold = nowMs - lookbackMinutes * 60_000;
  return parsed >= threshold;
}

export function toRetryTotal(transmissionRows) {
  if (!Array.isArray(transmissionRows)) {
    return 0;
  }

  return transmissionRows.reduce((sum, row) => {
    const retriedCount = Number(row?.retried_count || 0);
    if (!Number.isFinite(retriedCount)) return sum;
    return sum + Math.max(0, Math.floor(retriedCount));
  }, 0);
}

export function summarizeCoverageRows(rows) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const totalWebhookEvents = safeRows.reduce(
    (sum, row) => sum + Number(row?.webhookEvents || 0),
    0,
  );
  const totalRetryCount = safeRows.reduce(
    (sum, row) => sum + Number(row?.retryTotal || 0),
    0,
  );
  const missingOrders = safeRows
    .filter(row => Number(row?.webhookEvents || 0) <= 0)
    .map(row => String(row.orderId || "").trim())
    .filter(Boolean);

  return {
    totalWebhookEvents,
    totalRetryCount,
    missingOrders,
  };
}
