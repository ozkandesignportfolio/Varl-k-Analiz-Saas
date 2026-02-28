type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitStore = Map<string, RateLimitBucket>;

type RateLimitWindowParams = {
  scope: string;
  key: string;
  limit: number;
  windowMs: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

const STORE_KEY = "__assetcare_rate_limit_store__";

const getStore = (): RateLimitStore => {
  const globalWithStore = globalThis as typeof globalThis & {
    [STORE_KEY]?: RateLimitStore;
  };

  if (!globalWithStore[STORE_KEY]) {
    globalWithStore[STORE_KEY] = new Map<string, RateLimitBucket>();
  }

  return globalWithStore[STORE_KEY];
};

const normalizePart = (value: string) => value.trim().toLowerCase() || "anonymous";

export const getRequestIp = (request: Request): string => {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  return request.headers.get("x-real-ip")?.trim() || "unknown";
};

export const enforceRateLimit = (params: RateLimitWindowParams): RateLimitResult => {
  const limit = Math.max(1, Math.floor(params.limit));
  const windowMs = Math.max(500, Math.floor(params.windowMs));
  const now = Date.now();
  const bucketKey = `${normalizePart(params.scope)}:${normalizePart(params.key)}`;
  const store = getStore();
  const current = store.get(bucketKey);

  if (!current || current.resetAt <= now) {
    const nextBucket: RateLimitBucket = {
      count: 1,
      resetAt: now + windowMs,
    };
    store.set(bucketKey, nextBucket);
    return {
      allowed: true,
      remaining: Math.max(0, limit - 1),
      retryAfterMs: 0,
    };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(0, current.resetAt - now),
    };
  }

  current.count += 1;
  store.set(bucketKey, current);
  return {
    allowed: true,
    remaining: Math.max(0, limit - current.count),
    retryAfterMs: 0,
  };
};
