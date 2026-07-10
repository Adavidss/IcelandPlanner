// Shared HTTP helpers for all data scripts. Zero dependencies — Node 22 fetch.
// Every request identifies itself; retries cover transient network errors,
// 429 (honoring Retry-After) and 5xx with exponential backoff + jitter.

const UA = "IcelandPlanner/1.0 (+https://github.com/Adavidss/IcelandPlanner)";

export class FetchError extends Error {
  constructor(url, status, cause) {
    super(`fetch failed: ${status ?? "network"} ${url}`);
    this.url = url;
    this.status = status ?? null;
    this.cause = cause;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function fetchWithRetry(url, opts = {}) {
  const { tries = 3, timeoutMs = 30_000, backoffMs = 2_000, headers = {} } = opts;
  let lastErr;
  for (let attempt = 1; attempt <= tries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: { "user-agent": UA, ...headers },
        signal: ctrl.signal,
        redirect: "follow",
      });
      if (res.ok) return res;
      // Retry on 429 + 5xx only; 4xx (besides 429) won't get better.
      if (res.status !== 429 && res.status < 500) throw new FetchError(url, res.status);
      lastErr = new FetchError(url, res.status);
      const retryAfter = Number(res.headers.get("retry-after")) * 1000;
      if (attempt < tries) {
        await sleep(Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter
          : backoffMs * attempt * attempt + Math.random() * 500);
      }
    } catch (err) {
      if (err instanceof FetchError && err.status !== null && err.status !== 429 && err.status < 500) throw err;
      lastErr = err instanceof FetchError ? err : new FetchError(url, null, err);
      if (attempt < tries) await sleep(backoffMs * attempt * attempt + Math.random() * 500);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

export async function fetchJSON(url, opts = {}) {
  const res = await fetchWithRetry(url, opts);
  return res.json();
}

export async function fetchText(url, opts = {}) {
  const res = await fetchWithRetry(url, opts);
  return res.text();
}

/** Map over items with bounded concurrency and optional spacing between starts. */
export async function mapConcurrent(items, limit, spacingMs, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      if (spacingMs > 0) await sleep(spacingMs);
      try {
        results[i] = await fn(items[i], i);
      } catch (err) {
        results[i] = { __error: err };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
