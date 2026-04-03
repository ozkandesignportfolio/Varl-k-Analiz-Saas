import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";

type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

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
          accepted_kvkk: boolean;
          accepted_privacy_policy: boolean;
          accepted_terms: boolean;
          consented_at: string;
          created_at: string;
          email: string | null;
          id: string;
          ip: string | null;
          user_agent: string | null;
          user_id: string;
        };
        Insert: {
          accepted_kvkk: boolean;
          accepted_privacy_policy: boolean;
          accepted_terms: boolean;
          consented_at?: string;
          created_at?: string;
          email?: string | null;
          id?: string;
          ip?: string | null;
          user_agent?: string | null;
          user_id: string;
        };
        Update: {
          accepted_kvkk?: boolean;
          accepted_privacy_policy?: boolean;
          accepted_terms?: boolean;
          consented_at?: string;
          created_at?: string;
          email?: string | null;
          id?: string;
          ip?: string | null;
          user_agent?: string | null;
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

type UserConsentInsertParams = {
  acceptedKvkk: boolean;
  acceptedPrivacyPolicy: boolean;
  acceptedTerms: boolean;
  consentedAt?: string;
  email?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  userId: string;
};

export const insertUserConsent = async (params: UserConsentInsertParams) => {
  const client = supabaseAdmin as typeof supabaseAdmin & {
    from: <T extends keyof SignupSecurityDatabase["public"]["Tables"]>(
      table: T,
    ) => ReturnType<typeof supabaseAdmin.from>;
  };
  const { error } = await client.from("user_consents").insert({
    user_id: params.userId,
    email: params.email?.trim() || null,
    ip: params.ip?.trim() || null,
    user_agent: params.userAgent?.trim() || null,
    accepted_terms: params.acceptedTerms,
    accepted_privacy_policy: params.acceptedPrivacyPolicy,
    accepted_kvkk: params.acceptedKvkk,
    consented_at: params.consentedAt ?? new Date().toISOString(),
  });

  if (error) {
    throw new Error(`Failed to insert user consent: ${error.message}`);
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
