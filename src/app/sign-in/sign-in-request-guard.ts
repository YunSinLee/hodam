interface MutableRequestCounter {
  current: number;
}

export function beginSignInRequest(
  counter: MutableRequestCounter,
): () => boolean {
  const requestCounter = counter;
  const requestId = requestCounter.current + 1;
  requestCounter.current = requestId;
  return () => requestCounter.current === requestId;
}
