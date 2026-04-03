import "server-only";

import { hashRateLimitSubject, isUpstashRedisConfigured, runUpstashCommands } from "@/lib/auth/upstash-rate-limit";

type RiskSubjectKind = "device" | "email" | "ip";

type RiskLookupRequest = {
  deviceFingerprint?: string | null;
  email?: string | null;
  ip?: string | null;
};

export type RiskSnapshot = {
  device: number;
  email: number;
  ip: number;
  max: number;
};

const toScore = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(parsed)));
};

const normalizeSubject = (kind: RiskSubjectKind, value?: string | null) => {
  if (!value) {
    return null;
  }

  const normalized = kind === "email" ? value.trim().toLowerCase() : value.trim();
  return normalized.length > 0 ? normalized : null;
};

const buildRequestedKey = (kind: RiskSubjectKind, value: string) => `risk:${kind}:${value}`;

const buildLegacyKey = (kind: RiskSubjectKind, value: string) => {
  const hash = hashRateLimitSubject(value);
  return `risk:signup:score:${kind}:${hash}`;
};

const readScoreForSubject = async (kind: RiskSubjectKind, value?: string | null) => {
  const normalized = normalizeSubject(kind, value);
  if (!normalized || !isUpstashRedisConfigured()) {
    return 0;
  }

  const results = await runUpstashCommands([
    ["GET", buildRequestedKey(kind, normalized)],
    ["GET", buildLegacyKey(kind, normalized)],
  ]);

  return Math.max(toScore(results[0]), toScore(results[1]));
};

export const getRiskSnapshot = async (request: RiskLookupRequest): Promise<RiskSnapshot> => {
  const [ip, email, device] = await Promise.all([
    readScoreForSubject("ip", request.ip),
    readScoreForSubject("email", request.email),
    readScoreForSubject("device", request.deviceFingerprint),
  ]);

  return {
    device,
    email,
    ip,
    max: Math.max(ip, email, device),
  };
};
