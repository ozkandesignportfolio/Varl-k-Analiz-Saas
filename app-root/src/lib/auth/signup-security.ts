import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  createUserConsentsInsert,
  type UserConsentsInsert,
  validateUserConsentsPayload,
} from "@/schema/userConsents";

type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

// UNIFIED SCHEMA - Only 3 fields allowed:
// user_id, accepted_terms, consented_at
// DELETED: accepted_kvkk, accepted_privacy_policy, id, email, ip, user_agent, created_at
type SignupSecurityDatabase = {
  public: {
    Tables: {
      auth_security_logs: {
        Row: {
          created_at: string;
          email: string | null;
          event_type: string;
          id: string;
          ip: string | null;
          metadata: Json;
          user_agent: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          event_type: string;
          id?: string;
          ip?: string | null;
          metadata?: Json;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          event_type?: string;
          id?: string;
          ip?: string | null;
          metadata?: Json;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      user_consents: {
        Row: {
          accepted_terms: boolean;
          consented_at: string;
          user_id: string;
        };
        Insert: {
          accepted_terms: boolean;
          consented_at?: string;
          user_id: string;
        };
        Update: {
          accepted_terms?: boolean;
          consented_at?: string;
          user_id?: string;
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

type AuthSecurityEventParams = {
  email?: string | null;
  eventType: string;
  ip?: string | null;
  metadata?: Json;
  userAgent?: string | null;
  userId?: string | null;
};

// UNIFIED: Only accepted_terms is stored. KVKK and privacy are covered under terms.
type UserConsentInsertParams = {
  acceptedTerms: boolean;
  consentedAt?: string;
  userId: string;
};

export const insertUserConsent = async (params: UserConsentInsertParams) => {
  const client = supabaseAdmin as typeof supabaseAdmin & {
    from: <T extends keyof SignupSecurityDatabase["public"]["Tables"]>(
      table: T,
    ) => ReturnType<typeof supabaseAdmin.from>;
  };

  // Create payload using schema factory with validation
  const payload = createUserConsentsInsert({
    userId: params.userId,
    acceptedTerms: params.acceptedTerms,
    consentedAt: params.consentedAt,
  });

  // Additional runtime validation before DB insert
  validateUserConsentsPayload(payload as unknown as Record<string, unknown>, "insert");

  // Log final payload for debugging (development only)
  if (process.env.NODE_ENV === "development") {
    console.log("[insertUserConsent] Final validated payload:", payload);
  }

  // IDEMPOTENT UPSERT - safe to call multiple times, no duplicate key errors
  const { error } = await client
    .from("user_consents")
    .upsert(payload, { onConflict: "user_id" });

  if (error) {
    console.error("[insertUserConsent] Database upsert failed:", {
      error: error.message,
      code: (error as { code?: string }).code,
      userId: params.userId,
    });
    throw new Error(`Failed to upsert user consent: ${error.message}`);
  }
};

export const logAuthSecurityEvent = async (params: AuthSecurityEventParams) => {
  try {
    const client = supabaseAdmin as typeof supabaseAdmin & {
      from: <T extends keyof SignupSecurityDatabase["public"]["Tables"]>(
        table: T,
      ) => ReturnType<typeof supabaseAdmin.from>;
    };
    const { error } = await client.from("auth_security_logs").insert({
      event_type: params.eventType,
      user_id: params.userId ?? null,
      email: params.email?.trim() || null,
      ip: params.ip?.trim() || null,
      user_agent: params.userAgent?.trim() || null,
      metadata: params.metadata ?? {},
    });

    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    console.error("[auth.signup] Failed to persist auth security log.", error);
  }
};
