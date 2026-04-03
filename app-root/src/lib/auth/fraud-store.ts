import "server-only";

import { createClient } from "@supabase/supabase-js";

type FraudDatabase = {
  public: {
    Tables: {
      auth_fraud_events: {
        Row: {
          id: number;
          ip_hash: string;
          event: string;
          created_at: string;
        };
        Insert: {
          id?: never;
          ip_hash: string;
          event: string;
          created_at?: string;
        };
        Update: {
          id?: never;
          ip_hash?: string;
          event?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type FraudStore = {
  incrementIP(ipHash: string): Promise<number>;
  getIPAttempts(ipHash: string, window: number): Promise<number>;
  addEvent(ipHash: string, event: string): Promise<void>;
  getRecentEvents(ipHash: string): Promise<string[]>;
};

type FraudEventRow = {
  created_at: string | null;
  event: string | null;
};

const FRAUD_EVENTS_TABLE = "auth_fraud_events";
const ATTEMPT_EVENT = "attempt";
const RAPID_RETRY_EVENT = "rapid_retry";
const DEFAULT_WINDOW_MS = 10 * 60 * 1_000;
const RAPID_RETRY_WINDOW_MS = 30 * 1_000;
const RECENT_EVENTS_LIMIT = 50;

let fraudStoreSingleton: FraudStore | null = null;
let supabaseAdminClient: ReturnType<typeof createClient<FraudDatabase>> | null = null;

const normalizeIpHash = (ipHash: string) => ipHash.trim().toLowerCase() || "unknown";
const normalizeEvent = (event: string) => event.trim().toLowerCase();

const getRequiredEnv = (key: "NEXT_PUBLIC_SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY") => {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }

  return value;
};

const getSupabaseAdminClient = () => {
  if (!supabaseAdminClient) {
    supabaseAdminClient = createClient<FraudDatabase>(
      getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
      getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }

  return supabaseAdminClient;
};

const countAttemptEvents = async (ipHash: string, windowMs: number) => {
  const client = getSupabaseAdminClient();
  const sinceIso = new Date(Date.now() - windowMs).toISOString();
  const { count, error } = await client
    .from(FRAUD_EVENTS_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .eq("event", ATTEMPT_EVENT)
    .gte("created_at", sinceIso);

  if (error) {
    throw new Error(`Failed to count fraud attempts: ${error.message}`);
  }

  return Math.max(0, count ?? 0);
};

const insertEvent = async (ipHash: string, event: string) => {
  const normalizedEvent = normalizeEvent(event);
  if (!normalizedEvent) {
    return;
  }

  const client = getSupabaseAdminClient();
  const { error } = await client.from(FRAUD_EVENTS_TABLE).insert({
    ip_hash: ipHash,
    event: normalizedEvent,
  });

  if (error) {
    throw new Error(`Failed to persist fraud event: ${error.message}`);
  }
};

const getLastAttemptAt = async (ipHash: string) => {
  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from(FRAUD_EVENTS_TABLE)
    .select("created_at")
    .eq("ip_hash", ipHash)
    .eq("event", ATTEMPT_EVENT)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read latest fraud attempt: ${error.message}`);
  }

  return data?.created_at ? Date.parse(data.created_at) : null;
};

export const createFraudStore = (): FraudStore => ({
  async incrementIP(ipHash) {
    const normalizedIpHash = normalizeIpHash(ipHash);
    const lastAttemptAt = await getLastAttemptAt(normalizedIpHash);
    const now = Date.now();

    await insertEvent(normalizedIpHash, ATTEMPT_EVENT);

    if (lastAttemptAt !== null && now - lastAttemptAt <= RAPID_RETRY_WINDOW_MS) {
      await insertEvent(normalizedIpHash, RAPID_RETRY_EVENT);
    }

    return countAttemptEvents(normalizedIpHash, DEFAULT_WINDOW_MS);
  },

  async getIPAttempts(ipHash, window) {
    const normalizedIpHash = normalizeIpHash(ipHash);
    const normalizedWindow = Math.max(1, Math.floor(window));
    return countAttemptEvents(normalizedIpHash, normalizedWindow);
  },

  async addEvent(ipHash, event) {
    const normalizedIpHash = normalizeIpHash(ipHash);
    await insertEvent(normalizedIpHash, event);
  },

  async getRecentEvents(ipHash) {
    const normalizedIpHash = normalizeIpHash(ipHash);
    const sinceIso = new Date(Date.now() - DEFAULT_WINDOW_MS).toISOString();
    const client = getSupabaseAdminClient();
    const { data, error } = await client
      .from(FRAUD_EVENTS_TABLE)
      .select("event, created_at")
      .eq("ip_hash", normalizedIpHash)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(RECENT_EVENTS_LIMIT);

    if (error) {
      throw new Error(`Failed to read recent fraud events: ${error.message}`);
    }

    return (data ?? [])
      .map((row) => normalizeEvent((row as FraudEventRow).event ?? ""))
      .filter(Boolean);
  },
});

export const getFraudStore = () => {
  if (!fraudStoreSingleton) {
    fraudStoreSingleton = createFraudStore();
  }

  return fraudStoreSingleton;
};
