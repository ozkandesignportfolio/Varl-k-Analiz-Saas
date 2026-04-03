import "server-only";

import { randomUUID } from "crypto";
import { isUnknownDeviceFingerprint } from "@/lib/auth/device-fingerprint";
import { hashRateLimitSubject, runUpstashCommands } from "@/lib/auth/upstash-rate-limit";

const RISK_WINDOW_MS = 10 * 60 * 1_000;
const RISK_STATE_TTL_SECONDS = 30 * 24 * 60 * 60;

const suspiciousUserAgentPatterns = [
  /curl/i,
  /wget/i,
  /python/i,
  /axios/i,
  /node-fetch/i,
  /postmanruntime/i,
  /insomnia/i,
  /httpclient/i,
  /okhttp/i,
  /libwww-perl/i,
  /go-http-client/i,
  /java/i,
];

export type SignupRiskLevel = "low" | "medium" | "high" | "critical";

export type SignupRiskSummary = {
  level: SignupRiskLevel;
  reasons: string[];
  score: number;
  signals: {
    deviceAttemptsLast10m: number;
    emailAttemptsLast10m: number;
    emailDistinctDeviceCount: number;
    emailDistinctIpCount: number;
    hasDeviceFingerprint: boolean;
    ipAttemptsLast10m: number;
    ipDistinctEmailCount: number;
    isNewDevice: boolean;
    isNewIp: boolean;
    previousEmailRiskScore: number;
    previousIpRiskScore: number;
    turnstileErrorCodes: string[];
  };
};

type SignupRiskInput = {
  deviceFingerprint?: string | null;
  email: string;
  ip: string;
  outcome: string;
  rateLimit: {
    emailTriggered: boolean;
    ipTriggered: boolean;
  };
  turnstile: {
    errorCodes?: string[] | null;
    tokenPresent: boolean;
    verified: boolean;
  };
  userAgent?: string | null;
};

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const normalizeEmail = (value: string) => value.trim().toLowerCase();
const normalizeIp = (value: string) => value.trim() || "unknown";
const normalizeFingerprint = (value?: string | null) => {
  const normalized = value?.trim().toLowerCase() || null;
  return normalized && !isUnknownDeviceFingerprint(normalized) ? normalized : null;
};

const toInteger = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.floor(parsed));
};

const getRiskLevel = (score: number): SignupRiskLevel => {
  if (score >= 80) {
    return "critical";
  }

  if (score >= 60) {
    return "high";
  }

  if (score >= 30) {
    return "medium";
  }

  return "low";
};

const addRisk = (reasons: string[], reason: string, points: number, currentScore: number) => {
  reasons.push(reason);
  return currentScore + points;
};

export const assessSignupRisk = async (input: SignupRiskInput): Promise<SignupRiskSummary> => {
  const normalizedEmail = normalizeEmail(input.email);
  const normalizedIp = normalizeIp(input.ip);
  const normalizedFingerprint = normalizeFingerprint(input.deviceFingerprint);
  const hasEmail = normalizedEmail.length > 0;
  const hasDeviceFingerprint = Boolean(normalizedFingerprint);
  const now = Date.now();
  const windowFloor = now - RISK_WINDOW_MS;
  const ipHash = hashRateLimitSubject(normalizedIp);
  const emailHash = hasEmail ? hashRateLimitSubject(normalizedEmail) : null;
  const fingerprintHash = normalizedFingerprint ? hashRateLimitSubject(normalizedFingerprint) : null;
  const ipAttemptMember = `${now}:${randomUUID()}`;
  const emailAttemptMember = `${now}:${randomUUID()}`;
  const deviceAttemptMember = `${now}:${randomUUID()}`;

  const ipAttemptsKey = `risk:signup:attempts:ip:${ipHash}`;
  const ipFirstSeenKey = `risk:signup:first_seen:ip:${ipHash}`;
  const ipEmailsKey = `risk:signup:links:ip_emails:${ipHash}`;
  const ipRiskScoreKey = `risk:signup:score:ip:${ipHash}`;
  const ipRiskDetailsKey = `risk:signup:details:ip:${ipHash}`;
  const ipPublicRiskScoreKey = normalizedIp !== "unknown" ? `risk:ip:${normalizedIp}` : null;

  const emailAttemptsKey = emailHash ? `risk:signup:attempts:email:${emailHash}` : null;
  const emailIpsKey = emailHash ? `risk:signup:links:email_ips:${emailHash}` : null;
  const emailDevicesKey = emailHash ? `risk:signup:links:email_devices:${emailHash}` : null;
  const emailRiskScoreKey = emailHash ? `risk:signup:score:email:${emailHash}` : null;
  const emailRiskDetailsKey = emailHash ? `risk:signup:details:email:${emailHash}` : null;
  const emailPublicRiskScoreKey = hasEmail ? `risk:email:${normalizedEmail}` : null;

  const deviceAttemptsKey = fingerprintHash ? `risk:signup:attempts:device:${fingerprintHash}` : null;
  const deviceFirstSeenKey = fingerprintHash ? `risk:signup:first_seen:device:${fingerprintHash}` : null;
  const deviceRiskScoreKey = fingerprintHash ? `risk:signup:score:device:${fingerprintHash}` : null;
  const devicePublicRiskScoreKey = normalizedFingerprint ? `risk:device:${normalizedFingerprint}` : null;

  const commands: string[][] = [
    ["ZREMRANGEBYSCORE", ipAttemptsKey, "-inf", String(windowFloor)],
    ["ZADD", ipAttemptsKey, String(now), ipAttemptMember],
    ["PEXPIRE", ipAttemptsKey, String(RISK_WINDOW_MS)],
    ["ZCARD", ipAttemptsKey],
    ["SET", ipFirstSeenKey, String(now), "NX", "EX", String(RISK_STATE_TTL_SECONDS)],
    ["SADD", ipEmailsKey, emailHash ?? "__missing_email__"],
    ["EXPIRE", ipEmailsKey, String(RISK_STATE_TTL_SECONDS)],
    ["SCARD", ipEmailsKey],
    ["GET", ipRiskScoreKey],
  ];

  if (emailAttemptsKey && emailIpsKey && emailRiskScoreKey) {
    commands.push(
      ["ZREMRANGEBYSCORE", emailAttemptsKey, "-inf", String(windowFloor)],
      ["ZADD", emailAttemptsKey, String(now), emailAttemptMember],
      ["PEXPIRE", emailAttemptsKey, String(RISK_WINDOW_MS)],
      ["ZCARD", emailAttemptsKey],
      ["SADD", emailIpsKey, ipHash],
      ["EXPIRE", emailIpsKey, String(RISK_STATE_TTL_SECONDS)],
      ["SCARD", emailIpsKey],
      ["GET", emailRiskScoreKey],
    );
  }

  if (deviceAttemptsKey && deviceFirstSeenKey) {
    commands.push(
      ["ZREMRANGEBYSCORE", deviceAttemptsKey, "-inf", String(windowFloor)],
      ["ZADD", deviceAttemptsKey, String(now), deviceAttemptMember],
      ["PEXPIRE", deviceAttemptsKey, String(RISK_WINDOW_MS)],
      ["ZCARD", deviceAttemptsKey],
      ["SET", deviceFirstSeenKey, String(now), "NX", "EX", String(RISK_STATE_TTL_SECONDS)],
    );
  }

  if (emailDevicesKey && fingerprintHash) {
    commands.push(
      ["SADD", emailDevicesKey, fingerprintHash],
      ["EXPIRE", emailDevicesKey, String(RISK_STATE_TTL_SECONDS)],
      ["SCARD", emailDevicesKey],
    );
  }

  const results = await runUpstashCommands(commands);
  let cursor = 0;

  cursor += 3;
  const ipAttemptsLast10m = toInteger(results[cursor++]);
  const isNewIp = Boolean(results[cursor++]);
  cursor += 2;
  const ipDistinctEmailCount = toInteger(results[cursor++]);
  const previousIpRiskScore = toInteger(results[cursor++]);

  let emailAttemptsLast10m = 0;
  let emailDistinctIpCount = 0;
  let previousEmailRiskScore = 0;

  if (emailAttemptsKey) {
    cursor += 3;
    emailAttemptsLast10m = toInteger(results[cursor++]);
    cursor += 2;
    emailDistinctIpCount = toInteger(results[cursor++]);
    previousEmailRiskScore = toInteger(results[cursor++]);
  }

  let deviceAttemptsLast10m = 0;
  let isNewDevice = false;

  if (deviceAttemptsKey) {
    cursor += 3;
    deviceAttemptsLast10m = toInteger(results[cursor++]);
    isNewDevice = Boolean(results[cursor++]);
  }

  let emailDistinctDeviceCount = 0;

  if (emailDevicesKey && fingerprintHash) {
    cursor += 2;
    emailDistinctDeviceCount = toInteger(results[cursor++]);
  }

  const reasons: string[] = [];
  let score = 0;

  if (input.rateLimit.ipTriggered) {
    score = addRisk(reasons, "ip_rate_limit_triggered", 35, score);
  }

  if (input.rateLimit.emailTriggered) {
    score = addRisk(reasons, "email_rate_limit_triggered", 25, score);
  }

  if (!input.turnstile.tokenPresent) {
    score = addRisk(reasons, "turnstile_missing", 55, score);
  } else if (!input.turnstile.verified) {
    score = addRisk(reasons, "turnstile_invalid", 45, score);
  }

  if (input.turnstile.errorCodes?.length) {
    score = addRisk(reasons, `turnstile_flags_${input.turnstile.errorCodes.join("_")}`, 5, score);
  }

  if (normalizedIp === "unknown") {
    score = addRisk(reasons, "ip_missing_or_unknown", 12, score);
  }

  if (ipAttemptsLast10m > 1) {
    score = addRisk(reasons, `ip_attempt_burst_${ipAttemptsLast10m}`, Math.min(20, (ipAttemptsLast10m - 1) * 4), score);
  }

  if (emailAttemptsLast10m > 1) {
    score = addRisk(
      reasons,
      `email_attempt_burst_${emailAttemptsLast10m}`,
      Math.min(16, (emailAttemptsLast10m - 1) * 4),
      score,
    );
  }

  if (deviceAttemptsLast10m > 1) {
    score = addRisk(
      reasons,
      `device_attempt_burst_${deviceAttemptsLast10m}`,
      Math.min(15, (deviceAttemptsLast10m - 1) * 3),
      score,
    );
  }

  if (isNewIp) {
    score = addRisk(reasons, "new_ip_observed", 8, score);
  }

  if (!hasDeviceFingerprint) {
    score = addRisk(reasons, "device_fingerprint_missing", 10, score);
  } else if (isNewDevice) {
    score = addRisk(reasons, "new_device_fingerprint", 6, score);
  }

  if (emailDistinctIpCount > 1) {
    score = addRisk(
      reasons,
      `email_seen_from_multiple_ips_${emailDistinctIpCount}`,
      Math.min(15, (emailDistinctIpCount - 1) * 5),
      score,
    );
  }

  if (ipDistinctEmailCount > 2) {
    score = addRisk(
      reasons,
      `ip_seen_with_multiple_emails_${ipDistinctEmailCount}`,
      Math.min(18, (ipDistinctEmailCount - 2) * 6),
      score,
    );
  }

  if (emailDistinctDeviceCount > 1) {
    score = addRisk(
      reasons,
      `email_seen_from_multiple_devices_${emailDistinctDeviceCount}`,
      Math.min(12, (emailDistinctDeviceCount - 1) * 4),
      score,
    );
  }

  if (previousIpRiskScore >= 60 || previousEmailRiskScore >= 60) {
    score = addRisk(reasons, "prior_high_risk_history", 10, score);
  }

  if (!input.userAgent?.trim()) {
    score = addRisk(reasons, "missing_user_agent", 8, score);
  } else if (suspiciousUserAgentPatterns.some((pattern) => pattern.test(input.userAgent ?? ""))) {
    score = addRisk(reasons, "suspicious_user_agent", 15, score);
  }

  const normalizedScore = clampScore(score);
  const risk: SignupRiskSummary = {
    level: getRiskLevel(normalizedScore),
    reasons,
    score: normalizedScore,
    signals: {
      deviceAttemptsLast10m,
      emailAttemptsLast10m,
      emailDistinctDeviceCount,
      emailDistinctIpCount,
      hasDeviceFingerprint,
      ipAttemptsLast10m,
      ipDistinctEmailCount,
      isNewDevice,
      isNewIp,
      previousEmailRiskScore,
      previousIpRiskScore,
      turnstileErrorCodes: input.turnstile.errorCodes?.filter(Boolean) ?? [],
    },
  };

  const persistCommands: string[][] = [
    ["SET", ipRiskScoreKey, String(risk.score), "EX", String(RISK_STATE_TTL_SECONDS)],
    [
      "SET",
      ipRiskDetailsKey,
      JSON.stringify({
        ...risk,
        outcome: input.outcome,
        updatedAt: new Date().toISOString(),
      }),
      "EX",
      String(RISK_STATE_TTL_SECONDS),
    ],
  ];

  if (ipPublicRiskScoreKey) {
    persistCommands.push(["SET", ipPublicRiskScoreKey, String(risk.score), "EX", String(RISK_STATE_TTL_SECONDS)]);
  }

  if (emailRiskScoreKey && emailRiskDetailsKey) {
    persistCommands.push(
      ["SET", emailRiskScoreKey, String(risk.score), "EX", String(RISK_STATE_TTL_SECONDS)],
      [
        "SET",
        emailRiskDetailsKey,
        JSON.stringify({
          ...risk,
          outcome: input.outcome,
          updatedAt: new Date().toISOString(),
        }),
        "EX",
        String(RISK_STATE_TTL_SECONDS),
      ],
    );
  }

  if (emailPublicRiskScoreKey) {
    persistCommands.push(["SET", emailPublicRiskScoreKey, String(risk.score), "EX", String(RISK_STATE_TTL_SECONDS)]);
  }

  if (deviceRiskScoreKey) {
    persistCommands.push(["SET", deviceRiskScoreKey, String(risk.score), "EX", String(RISK_STATE_TTL_SECONDS)]);
  }

  if (devicePublicRiskScoreKey) {
    persistCommands.push(["SET", devicePublicRiskScoreKey, String(risk.score), "EX", String(RISK_STATE_TTL_SECONDS)]);
  }

  await runUpstashCommands(persistCommands);

  return risk;
};
