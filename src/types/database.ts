export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type Database = {
  public: {
    Tables: {
      assets: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          category: string;
          brand: string | null;
          model: string | null;
          purchase_price: number | null;
          purchase_date: string | null;
          warranty_end_date: string | null;
          serial_number: string | null;
          notes: string | null;
          photo_path: string | null;
          qr_code: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          category: string;
          brand?: string | null;
          model?: string | null;
          purchase_price?: number | null;
          purchase_date?: string | null;
          warranty_end_date?: string | null;
          serial_number?: string | null;
          notes?: string | null;
          photo_path?: string | null;
          qr_code?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          category?: string;
          brand?: string | null;
          model?: string | null;
          purchase_price?: number | null;
          purchase_date?: string | null;
          warranty_end_date?: string | null;
          serial_number?: string | null;
          notes?: string | null;
          photo_path?: string | null;
          qr_code?: string;
          updated_at?: string;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          user_id: string;
          entity_type: "assets" | "maintenance_rules" | "service_logs" | "documents";
          entity_id: string;
          action: "insert" | "update" | "delete";
          changed_fields: string[];
          old_values: Json | null;
          new_values: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          entity_type: "assets" | "maintenance_rules" | "service_logs" | "documents";
          entity_id: string;
          action: "insert" | "update" | "delete";
          changed_fields?: string[];
          old_values?: Json | null;
          new_values?: Json | null;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          entity_type?: "assets" | "maintenance_rules" | "service_logs" | "documents";
          entity_id?: string;
          action?: "insert" | "update" | "delete";
          changed_fields?: string[];
          old_values?: Json | null;
          new_values?: Json | null;
          created_at?: string;
        };
      };
      maintenance_rules: {
        Row: {
          id: string;
          asset_id: string;
          user_id: string;
          title: string;
          interval_value: number;
          interval_unit: "day" | "week" | "month" | "year";
          last_service_date: string | null;
          next_due_date: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          asset_id: string;
          user_id: string;
          title: string;
          interval_value: number;
          interval_unit: "day" | "week" | "month" | "year";
          last_service_date?: string | null;
          next_due_date: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          interval_value?: number;
          interval_unit?: "day" | "week" | "month" | "year";
          last_service_date?: string | null;
          next_due_date?: string;
          is_active?: boolean;
          updated_at?: string;
        };
      };
      service_logs: {
        Row: {
          id: string;
          asset_id: string;
          user_id: string;
          rule_id: string | null;
          service_type: string;
          service_date: string;
          cost: number;
          provider: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          asset_id: string;
          user_id: string;
          rule_id?: string | null;
          service_type: string;
          service_date: string;
          cost?: number;
          provider?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          rule_id?: string | null;
          service_type?: string;
          service_date?: string;
          cost?: number;
          provider?: string | null;
          notes?: string | null;
        };
      };
      documents: {
        Row: {
          id: string;
          asset_id: string;
          user_id: string;
          service_log_id: string | null;
          document_type: string;
          file_name: string;
          storage_path: string;
          file_size: number | null;
          uploaded_at: string;
        };
        Insert: {
          id?: string;
          asset_id: string;
          user_id: string;
          service_log_id?: string | null;
          document_type: string;
          file_name: string;
          storage_path: string;
          file_size?: number | null;
          uploaded_at?: string;
        };
        Update: {
          service_log_id?: string | null;
          document_type?: string;
          file_name?: string;
          storage_path?: string;
          file_size?: number | null;
        };
      };
      profiles: {
        Row: {
          id: string;
          plan: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          stripe_current_period_end: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          plan?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          stripe_current_period_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          plan?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          stripe_current_period_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      asset_media: {
        Row: {
          id: string;
          asset_id: string;
          user_id: string;
          type: "image" | "video" | "audio";
          storage_path: string;
          mime_type: string;
          size_bytes: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          asset_id: string;
          user_id: string;
          type: "image" | "video" | "audio";
          storage_path: string;
          mime_type: string;
          size_bytes: number;
          created_at?: string;
        };
        Update: {
          type?: "image" | "video" | "audio";
          storage_path?: string;
          mime_type?: string;
          size_bytes?: number;
          created_at?: string;
        };
      };
      billing_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          maintenance_rule_id: string | null;
          provider_name: string;
          subscription_name: string;
          plan_name: string | null;
          billing_cycle: "monthly" | "yearly";
          amount: number;
          currency: string;
          next_billing_date: string | null;
          auto_renew: boolean;
          status: "active" | "paused" | "cancelled";
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          maintenance_rule_id?: string | null;
          provider_name: string;
          subscription_name: string;
          plan_name?: string | null;
          billing_cycle?: "monthly" | "yearly";
          amount: number;
          currency?: string;
          next_billing_date?: string | null;
          auto_renew?: boolean;
          status?: "active" | "paused" | "cancelled";
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          maintenance_rule_id?: string | null;
          provider_name?: string;
          subscription_name?: string;
          plan_name?: string | null;
          billing_cycle?: "monthly" | "yearly";
          amount?: number;
          currency?: string;
          next_billing_date?: string | null;
          auto_renew?: boolean;
          status?: "active" | "paused" | "cancelled";
          notes?: string | null;
          updated_at?: string;
        };
      };
      billing_invoices: {
        Row: {
          id: string;
          user_id: string;
          subscription_id: string;
          invoice_no: string | null;
          period_start: string | null;
          period_end: string | null;
          issued_at: string;
          due_date: string | null;
          paid_at: string | null;
          amount: number;
          tax_amount: number;
          total_amount: number;
          status: "pending" | "paid" | "overdue" | "cancelled";
          file_path: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          subscription_id: string;
          invoice_no?: string | null;
          period_start?: string | null;
          period_end?: string | null;
          issued_at?: string;
          due_date?: string | null;
          paid_at?: string | null;
          amount: number;
          tax_amount?: number;
          total_amount: number;
          status?: "pending" | "paid" | "overdue" | "cancelled";
          file_path?: string | null;
          created_at?: string;
        };
        Update: {
          subscription_id?: string;
          invoice_no?: string | null;
          period_start?: string | null;
          period_end?: string | null;
          issued_at?: string;
          due_date?: string | null;
          paid_at?: string | null;
          amount?: number;
          tax_amount?: number;
          total_amount?: number;
          status?: "pending" | "paid" | "overdue" | "cancelled";
          file_path?: string | null;
        };
      };
      subscription_requests: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          phone: string | null;
          plan_code: "starter" | "pro" | "elite";
          billing_cycle: "monthly" | "yearly";
          status: "new" | "contacted" | "won" | "lost";
          source: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          email: string;
          phone?: string | null;
          plan_code: "starter" | "pro" | "elite";
          billing_cycle: "monthly" | "yearly";
          status?: "new" | "contacted" | "won" | "lost";
          source?: string;
          created_at?: string;
        };
        Update: {
          full_name?: string;
          email?: string;
          phone?: string | null;
          plan_code?: "starter" | "pro" | "elite";
          billing_cycle?: "monthly" | "yearly";
          status?: "new" | "contacted" | "won" | "lost";
          source?: string;
        };
      };
    };
  };
};
