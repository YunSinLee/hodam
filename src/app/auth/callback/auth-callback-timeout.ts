export const AUTH_STEP_TIMEOUT_MS = 15000;
export const AUTH_TOTAL_TIMEOUT_MS = 22000;
export const AUTH_NO_PAYLOAD_SESSION_TIMEOUT_MS = 5000;
export const AUTH_MANUAL_RECOVERY_HINT_MS = 8000;

export function wait(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timeout (${timeoutMs}ms)`));
    }, timeoutMs);

    promise
      .then(result => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timer);
        reject(error);
      });
  });
}
