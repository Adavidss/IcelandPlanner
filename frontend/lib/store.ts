// Tiny localStorage wrapper: `ip.`-prefixed keys, JSON serialization, and
// error-swallowing (private mode / SSR safe). Keys carry a .v1 suffix so a
// future schema change can migrate instead of corrupt.

export function storeGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(`ip.${key}`);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function storeSet(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`ip.${key}`, JSON.stringify(value));
  } catch {
    // storage full / private mode — state just won't persist
  }
}

export function storeRemove(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(`ip.${key}`);
  } catch {
    /* ignore */
  }
}
