function randomToken(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Correlation ids, shaped `tdb-<instance>-<counter>-<random>`.
 *
 * The counter rules out a collision inside one client even on the `Math.random` fallback, and
 * the instance segment lets two clients in the same document ignore each other's traffic —
 * a provider plus a standalone client is an easy accident.
 */
export function createRequestIdFactory(): () => string {
  const instance = randomToken().slice(0, 8);
  let counter = 0;

  return () => {
    counter += 1;
    return `tdb-${instance}-${counter}-${randomToken().slice(0, 8)}`;
  };
}
