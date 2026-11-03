// Poll an async vendor task (photo dance, motion transfer, video gen…)
// until it succeeds, fails, or times out. Exponential backoff with a cap.
const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function pollTask(fetchStatus, {
  intervalMs = 2000,
  backoffFactor = 1.5,
  maxIntervalMs = 15000,
  timeoutMs = 10 * 60 * 1000,
  sleep = defaultSleep,
  now = Date.now,
} = {}) {
  const started = now();
  let delay = intervalMs;
  for (;;) {
    const status = await fetchStatus();
    if (status.status === 'succeeded') return status.result ?? status;
    if (status.status === 'failed') {
      throw new Error(`Task failed: ${status.error ?? 'unknown vendor error'}`);
    }
    if (now() - started >= timeoutMs) {
      throw new Error(`Task timed out after ${timeoutMs}ms (last status: ${status.status})`);
    }
    await sleep(delay);
    delay = Math.min(delay * backoffFactor, maxIntervalMs);
  }
}
