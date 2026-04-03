import "server-only";

import { getFraudStore } from "@/lib/auth/fraud-store";

export type FraudScore = {
  score: number;
  reason: string[];
};

export type SignupFraudAssessment = FraudScore & {
  attemptsLast10m: number;
  botFailuresLast10m: number;
  disposableEmail: boolean;
  emailDomain: string | null;
  invalidEmail: boolean;
  rapidRetryDetected: boolean;
  rapidRetriesLast10m: number;
  rateLimitTriggersLast10m: number;
};

type SignupFraudSignalInput = {
  email: string;
  ip: string;
  rateLimitTriggered?: boolean;
  turnstileToken?: string | null;
  turnstileVerified?: boolean | null;
  userAgent?: string | null;
};

type SignupFraudBucket = {
  attemptsLast10m: number;
  botFailuresLast10m: number;
  rapidRetriesLast10m: number;
  rateLimitTriggersLast10m: number;
};

const FRAUD_WINDOW_MS = 10 * 60 * 1_000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

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

const disposableEmailDomains = new Set([
  "10minutemail.com",
  "dispostable.com",
  "fakeinbox.com",
  "getnada.com",
  "guerrillamail.com",
  "maildrop.cc",
  "mailinator.com",
  "sharklasers.com",
  "temp-mail.org",
  "tempmail.com",
  "trashmail.com",
  "yopmail.com",
]);

const normalizeIp = (ip: string) => ip.trim() || "unknown";
const normalizeEmail = (email: string) => email.trim().toLowerCase();

const getEmailDomain = (email: string) => {
  const normalized = normalizeEmail(email);
  const atIndex = normalized.lastIndexOf("@");
  if (atIndex <= 0 || atIndex === normalized.length - 1) {
    return null;
  }

  return normalized.slice(atIndex + 1);
};

export const isValidSignupEmail = (email: string) => EMAIL_REGEX.test(normalizeEmail(email));

export const isDisposableEmailDomain = (email: string) => {
  const domain = getEmailDomain(email);
  return domain ? disposableEmailDomains.has(domain) : false;
};

const countEvent = (events: string[], event: string) => events.filter((item) => item === event).length;

export const recordSignupAttempt = async (ip: string) => {
  const store = getFraudStore();
  const attemptsLast10m = await store.incrementIP(normalizeIp(ip));
  const recentEvents = await store.getRecentEvents(normalizeIp(ip));
  const rapidRetriesLast10m = countEvent(recentEvents, "rapid_retry");
  return {
    attemptsLast10m,
    rapidRetryDetected: rapidRetriesLast10m > 0,
    rapidRetriesLast10m,
  };
};

export const recordSignupRateLimitTrigger = async (ip: string) => {
  const store = getFraudStore();
  await store.addEvent(normalizeIp(ip), "rate_limit_trigger");
  const recentEvents = await store.getRecentEvents(normalizeIp(ip));
  return countEvent(recentEvents, "rate_limit_trigger");
};

export const recordSignupBotFailure = async (ip: string) => {
  const store = getFraudStore();
  await store.addEvent(normalizeIp(ip), "bot_failure");
  const recentEvents = await store.getRecentEvents(normalizeIp(ip));
  return countEvent(recentEvents, "bot_failure");
};

const getSignupFraudMetrics = async (ip: string): Promise<SignupFraudBucket> => {
  const normalizedIp = normalizeIp(ip);
  const store = getFraudStore();
  const [attemptsLast10m, recentEvents] = await Promise.all([
    store.getIPAttempts(normalizedIp, FRAUD_WINDOW_MS),
    store.getRecentEvents(normalizedIp),
  ]);

  return {
    attemptsLast10m,
    botFailuresLast10m: countEvent(recentEvents, "bot_failure"),
    rapidRetriesLast10m: countEvent(recentEvents, "rapid_retry"),
    rateLimitTriggersLast10m: countEvent(recentEvents, "rate_limit_trigger"),
  };
};

const clampScore = (score: number) => Math.max(0, Math.min(100, Math.round(score)));

export const calculateSignupFraudScore = async (input: SignupFraudSignalInput): Promise<SignupFraudAssessment> => {
  const metrics = await getSignupFraudMetrics(input.ip);
  const normalizedEmail = normalizeEmail(input.email);
  const invalidEmail = !isValidSignupEmail(normalizedEmail);
  const emailDomain = getEmailDomain(normalizedEmail);
  const disposableEmail = isDisposableEmailDomain(normalizedEmail);
  const normalizedUserAgent = input.userAgent?.trim() ?? "";
  const reason: string[] = [];
  let score = 0;

  if (invalidEmail) {
    reason.push("invalid_email_format");
    score = 100;
  }

  if (!normalizedUserAgent) {
    reason.push("missing_user_agent");
    score += 15;
  } else if (suspiciousUserAgentPatterns.some((pattern) => pattern.test(normalizedUserAgent))) {
    reason.push("suspicious_user_agent");
    score += 20;
  }

  if (metrics.attemptsLast10m > 1) {
    reason.push(`ip_repeat_attempts_${metrics.attemptsLast10m}`);
    score += Math.min(20, (metrics.attemptsLast10m - 1) * 5);
  }

  if (metrics.rateLimitTriggersLast10m > 0 || input.rateLimitTriggered) {
    const triggerCount = metrics.rateLimitTriggersLast10m + (input.rateLimitTriggered ? 1 : 0);
    reason.push(`rate_limit_triggers_${triggerCount}`);
    score += Math.min(25, triggerCount * 10);
  }

  if (metrics.botFailuresLast10m > 0) {
    reason.push(`bot_detection_failures_${metrics.botFailuresLast10m}`);
    score += Math.min(20, metrics.botFailuresLast10m * 8);
  }

  if (metrics.rapidRetriesLast10m > 0) {
    reason.push(`rapid_retry_pattern_${metrics.rapidRetriesLast10m}`);
    score += Math.min(15, metrics.rapidRetriesLast10m * 5);
  }

  if (!input.turnstileToken?.trim()) {
    reason.push("turnstile_missing");
    score += 70;
  } else if (input.turnstileVerified === false) {
    reason.push("turnstile_failed");
    score += 50;
  }

  if (disposableEmail) {
    reason.push(`disposable_email_domain_${emailDomain}`);
    score += 30;
  }

  return {
    score: clampScore(score),
    reason,
    attemptsLast10m: metrics.attemptsLast10m,
    botFailuresLast10m: metrics.botFailuresLast10m,
    disposableEmail,
    emailDomain,
    invalidEmail,
    rapidRetryDetected: metrics.rapidRetriesLast10m > 0,
    rapidRetriesLast10m: metrics.rapidRetriesLast10m,
    rateLimitTriggersLast10m: metrics.rateLimitTriggersLast10m,
  };
};
