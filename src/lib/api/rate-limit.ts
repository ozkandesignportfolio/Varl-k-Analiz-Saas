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

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

type DbRateLimitRpcRow = {
  allowed: boolean | null;
  remaining: number | null;
  retry_after_ms: number | null;
};

type DbRateLimitRpcClient = {
  rpc: (
    fn: "take_api_rate_limit_token",
    args: {
      p_scope: string;
      p_subject: string;
      p_capacity: number;
      p_refill_per_sec: number;
      p_cost: number;
      p_ttl_seconds: number;
    },
  ) => Promise<{ data: DbRateLimitRpcRow[] | DbRateLimitRpcRow | null; error: { message?: string } | null }>;
};

type EnforceUserRateLimitParams = {
  client: unknown;
  scope: string;
  userId: string;
  capacity: number;
  refillPerSecond: number;
  cost?: number;
  ttlSeconds?: number;
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

const toPositiveInt = (value: number, fallback: number, min = 1) => {
  const parsed = Math.floor(value);
  if (!Number.isFinite(parsed) || parsed < min) {
    return fallback;
  }
  return parsed;
};

const toPositiveNumber = (value: number, fallback: number, min = 0.0001) => {
  if (!Number.isFinite(value) || value < min) {
    return fallback;
  }
  return value;
};

const normalizeSubject = (value: string) => value.trim().toLowerCase() || "anonymous";

const readDbRateLimitRow = (raw: DbRateLimitRpcRow[] | DbRateLimitRpcRow | null): RateLimitResult | null => {
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (!row || typeof row.allowed !== "boolean") {
    return null;
  }

  return {
    allowed: row.allowed,
    remaining: Math.max(0, Number.isFinite(Number(row.remaining)) ? Math.floor(Number(row.remaining)) : 0),
    retryAfterMs: Math.max(
      0,
      Number.isFinite(Number(row.retry_after_ms)) ? Math.floor(Number(row.retry_after_ms)) : 0,
    ),
  };
};

export const enforceUserRateLimit = async (params: EnforceUserRateLimitParams): Promise<RateLimitResult> => {
  const capacity = toPositiveInt(params.capacity, 10);
  const refillPerSecond = toPositiveNumber(params.refillPerSecond, 1);
  const cost = toPositiveInt(params.cost ?? 1, 1);
  const ttlSeconds = toPositiveInt(params.ttlSeconds ?? 180, 180, 5);
  const subject = normalizeSubject(params.userId);
  const fallbackWindowMs = Math.max(5_000, Math.round((capacity / refillPerSecond) * 1_000));

  try {
    const rpcClient = params.client as DbRateLimitRpcClient;
    const { data, error } = await rpcClient.rpc("take_api_rate_limit_token", {
      p_scope: params.scope,
      p_subject: subject,
      p_capacity: capacity,
      p_refill_per_sec: refillPerSecond,
      p_cost: cost,
      p_ttl_seconds: ttlSeconds,
    });

    if (error) {
      throw new Error(error.message ?? "DB rate limit RPC failed.");
    }

    const row = readDbRateLimitRow(data);
    if (!row) {
      throw new Error("DB rate limit RPC returned invalid payload.");
    }
    return row;
  } catch {
    if (process.env.NODE_ENV === "production") {
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: 60_000,
      };
    }

    return enforceRateLimit({
      scope: `${params.scope}_memory_fallback`,
      key: subject,
      limit: capacity,
      windowMs: fallbackWindowMs,
    });
  }
};
