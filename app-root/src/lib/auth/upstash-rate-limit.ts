import "server-only";

import { createHash, randomUUID } from "crypto";

type UpstashResult = {
  error?: string;
  result?: unknown;
};

type SlidingWindowRateLimitParams = {
  limit: number;
  scope: string;
  subject: string;
  windowMs: number;
};

export type UpstashRedisCommand = string[];

export type SlidingWindowRateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

const getUpstashConfig = () => {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim() || null;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim() || null;

  if (!url || !token) {
    return null;
  }

  return { token, url };
};

const getRequiredUpstashConfig = () => {
  const config = getUpstashConfig();
  if (!config) {
    throw new Error("Missing Upstash Redis env vars. Check UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.");
  }

  return config;
};

const normalizeSubject = (value: string) => value.trim().toLowerCase();

export const isUpstashRateLimitConfigured = () => Boolean(getUpstashConfig());
export const isUpstashRedisConfigured = isUpstashRateLimitConfigured;

export const hashRateLimitSubject = (value: string) =>
  createHash("sha256").update(normalizeSubject(value)).digest("hex").slice(0, 40);

const toInteger = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.floor(parsed));
};

const readOldestScore = (value: unknown) => {
  if (!Array.isArray(value) || value.length < 2) {
    return null;
  }

  const score = Number(value[1]);
  return Number.isFinite(score) ? score : null;
};

export const runUpstashCommands = async (commands: UpstashRedisCommand[]) => {
  const { token, url } = getRequiredUpstashConfig();
  const response = await fetch(`${url}/multi-exec`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Upstash multi-exec failed with status ${response.status}.`);
  }

  const payload = (await response.json().catch(() => null)) as UpstashResult[] | null;
  if (!Array.isArray(payload)) {
    throw new Error("Upstash multi-exec returned an invalid payload.");
  }

  return payload.map((entry) => {
    if (entry.error) {
      throw new Error(`Upstash command failed: ${entry.error}`);
    }

    return entry.result;
  });
};

const getResult = (payload: unknown[], index: number) => {
  const entry = payload[index];
  if (typeof entry === "undefined") {
    throw new Error(`Upstash multi-exec missing result at index ${index}.`);
  }

  return entry;
};

export const takeSlidingWindowRateLimit = async (
  params: SlidingWindowRateLimitParams,
): Promise<SlidingWindowRateLimitResult> => {
  const limit = Math.max(1, Math.floor(params.limit));
  const windowMs = Math.max(1_000, Math.floor(params.windowMs));
  const now = Date.now();
  const oldestIncludedScore = now - windowMs;
  const member = `${now}:${randomUUID()}`;
  const key = `rate_limit:${params.scope}:${hashRateLimitSubject(params.subject)}`;

  const payload = await runUpstashCommands([
    ["ZREMRANGEBYSCORE", key, "-inf", String(oldestIncludedScore)],
    ["ZCARD", key],
    ["ZRANGE", key, "0", "0", "WITHSCORES"],
    ["ZADD", key, String(now), member],
    ["PEXPIRE", key, String(windowMs)],
  ]);

  const countBefore = toInteger(getResult(payload, 1));
  const oldestScore = readOldestScore(getResult(payload, 2));
  const totalCount = countBefore + 1;
  const allowed = totalCount <= limit;
  const retryAfterMs = allowed
    ? 0
    : Math.max(1_000, oldestScore === null ? windowMs : Math.ceil(windowMs - (now - oldestScore)));

  return {
    allowed,
    remaining: allowed ? Math.max(0, limit - totalCount) : 0,
    retryAfterMs,
  };
};
