const hits = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, maxPerWindow: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return true; // allowed
  }

  if (entry.count >= maxPerWindow) {
    return false; // blocked
  }

  entry.count++;
  return true; // allowed
}

export function rateLimitResponse() {
  return Response.json(
    { error: "Too many requests. Please try again later." },
    { status: 429 },
  );
}
