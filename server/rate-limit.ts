type Bucket = { tokens: number; lastRefill: number };

const buckets = new Map<string, Bucket>();
const MAX_TOKENS = Number(process.env.RATE_LIMIT_MAX ?? 20);
const REFILL_MS = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);

export function checkRateLimit(key: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || now - bucket.lastRefill >= REFILL_MS) {
    bucket = { tokens: MAX_TOKENS, lastRefill: now };
    buckets.set(key, bucket);
  }

  if (bucket.tokens <= 0) return { allowed: false, remaining: 0 };

  bucket.tokens -= 1;
  return { allowed: true, remaining: bucket.tokens };
}

setInterval(() => {
  const cutoff = Date.now() - REFILL_MS * 2;
  for (const [key, bucket] of buckets) {
    if (bucket.lastRefill < cutoff) buckets.delete(key);
  }
}, 5 * 60_000);
