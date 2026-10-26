// Simple per-IP token bucket. No Redis/shared state needed: this app runs as
// a single Node process, so an in-memory Map is sufficient and avoids an
// extra dependency.
export function createRateLimiter({ capacity, refillMs, message } = {}) {
  const cap = capacity ?? 5;
  const refillIntervalMs = refillMs ?? 10_000; // +1 token every 10s
  const buckets = new Map(); // ip -> { tokens, lastRefill }

  return function rateLimit(req, res, next) {
    const key = req.ip;
    const now = Date.now();
    let bucket = buckets.get(key);

    if (!bucket) {
      bucket = { tokens: cap, lastRefill: now };
      buckets.set(key, bucket);
    } else {
      const elapsed = now - bucket.lastRefill;
      const refilled = Math.floor(elapsed / refillIntervalMs);
      if (refilled > 0) {
        bucket.tokens = Math.min(cap, bucket.tokens + refilled);
        bucket.lastRefill = now;
      }
    }

    if (bucket.tokens <= 0) {
      return res.status(429).json({ error: message ?? 'Prea multe cereri. Încearcă din nou mai târziu.' });
    }

    bucket.tokens -= 1;
    next();
  };
}
