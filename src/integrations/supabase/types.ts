export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string | null
          actor_id: string | null
          actor_type: string | null
          created_at: string
          id: number
          metadata: Json | null
          page_url: string | null
          target_id: number | null
          target_type: string | null
        }
        Insert: {
          action?: string | null
          actor_id?: string | null
          actor_type?: string | null
          created_at?: string
          id?: number
          metadata?: Json | null
          page_url?: string | null
          target_id?: number | null
          target_type?: string | null
        }
        Update: {
          action?: string | null
          actor_id?: string | null
          actor_type?: string | null
          created_at?: string
          id?: number
          metadata?: Json | null
          page_url?: string | null
          target_id?: number | null
          target_type?: string | null
        }
        Relationships: []
      }
      complaints: {
        Row: {
          assigned_to: string | null
          body: string | null
          created_at: string
          id: number
          resolved_at: string | null
          severity: string | null
          status: string | null
          target: string | null
          user_id: number | null
        }
        Insert: {
          assigned_to?: string | null
          body?: string | null
          created_at?: string
          id?: number
          resolved_at?: string | null
          severity?: string | null
          status?: string | null
          target?: string | null
          user_id?: number | null
        }
        Update: {
          assigned_to?: string | null
          body?: string | null
          created_at?: string
          id?: number
          resolved_at?: string | null
          severity?: string | null
          status?: string | null
          target?: string | null
          user_id?: number | null
        }
        Relationships: []
      }
      deposits: {
        Row: {
          admin_notes: string | null
          amount_usdt: number | null
          blockchain_status: string | null
          created_at: string
          id: number
          internal_status: string | null
          network: string | null
          order_id: number | null
          tx_hash: string | null
          user_id: number
          verified_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          amount_usdt?: number | null
          blockchain_status?: string | null
          created_at?: string
          id?: number
          internal_status?: string | null
          network?: string | null
          order_id?: number | null
          tx_hash?: string | null
          user_id: number
          verified_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          amount_usdt?: number | null
          blockchain_status?: string | null
          created_at?: string
          id?: number
          internal_status?: string | null
          network?: string | null
          order_id?: number | null
          tx_hash?: string | null
          user_id?: number
          verified_at?: string | null
        }
        Relationships: []
      }
      email_otps: {
        Row: {
          attempts: number
          code_hash: string
          created_at: string
          email: string
          expires_at: string
          id: number
          purpose: string
          used: boolean
          user_id: number | null
        }
        Insert: {
          attempts?: number
          code_hash: string
          created_at?: string
          email: string
          expires_at: string
          id?: number
          purpose: string
          used?: boolean
          user_id?: number | null
        }
        Update: {
          attempts?: number
          code_hash?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: number
          purpose?: string
          used?: boolean
          user_id?: number | null
        }
        Relationships: []
      }
      email_queue: {
        Row: {
          body: string | null
          error: string | null
          id: number
          scheduled_at: string | null
          sent_at: string | null
          status: string | null
          subject: string | null
          template: string | null
          to_email: string | null
          to_name: string | null
        }
        Insert: {
          body?: string | null
          error?: string | null
          id?: number
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          template?: string | null
          to_email?: string | null
          to_name?: string | null
        }
        Update: {
          body?: string | null
          error?: string | null
          id?: number
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          template?: string | null
          to_email?: string | null
          to_name?: string | null
        }
        Relationships: []
      }
      escalations: {
        Row: {
          case_id: number | null
          case_type: string | null
          escalated_at: string
          escalated_by: string | null
          from_level: string | null
          id: number
          reason: string | null
          to_level: string | null
        }
        Insert: {
          case_id?: number | null
          case_type?: string | null
          escalated_at?: string
          escalated_by?: string | null
          from_level?: string | null
          id?: number
          reason?: string | null
          to_level?: string | null
        }
        Update: {
          case_id?: number | null
          case_type?: string | null
          escalated_at?: string
          escalated_by?: string | null
          from_level?: string | null
          id?: number
          reason?: string | null
          to_level?: string | null
        }
        Relationships: []
      }
      financial_reports: {
        Row: {
          amount_usdt: number | null
          count: number | null
          generated_at: string
          id: number
          metric: string | null
          period: string | null
          report_kind: string | null
        }
        Insert: {
          amount_usdt?: number | null
          count?: number | null
          generated_at?: string
          id?: number
          metric?: string | null
          period?: string | null
          report_kind?: string | null
        }
        Update: {
          amount_usdt?: number | null
          count?: number | null
          generated_at?: string
          id?: number
          metric?: string | null
          period?: string | null
          report_kind?: string | null
        }
        Relationships: []
      }
      internal_notes: {
        Row: {
          author: string | null
          body: string | null
          case_id: number | null
          case_type: string | null
          created_at: string
          id: number
          visibility: string | null
        }
        Insert: {
          author?: string | null
          body?: string | null
          case_id?: number | null
          case_type?: string | null
          created_at?: string
          id?: number
          visibility?: string | null
        }
        Update: {
          author?: string | null
          body?: string | null
          case_id?: number | null
          case_type?: string | null
          created_at?: string
          id?: number
          visibility?: string | null
        }
        Relationships: []
      }
      kyc_records: {
        Row: {
          country: string | null
          doc_number: string | null
          doc_type: string | null
          document_image: string | null
          full_name: string | null
          id: number
          reviewed_at: string | null
          reviewer_id: string | null
          reviewer_notes: string | null
          status: string | null
          submitted_at: string
          user_id: number | null
        }
        Insert: {
          country?: string | null
          doc_number?: string | null
          doc_type?: string | null
          document_image?: string | null
          full_name?: string | null
          id?: number
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          status?: string | null
          submitted_at?: string
          user_id?: number | null
        }
        Update: {
          country?: string | null
          doc_number?: string | null
          doc_type?: string | null
          document_image?: string | null
          full_name?: string | null
          id?: number
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          status?: string | null
          submitted_at?: string
          user_id?: number | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string | null
          case_id: number | null
          case_type: string | null
          created_at: string
          direction: string | null
          id: number
          sender_name: string | null
          user_id: number | null
        }
        Insert: {
          body?: string | null
          case_id?: number | null
          case_type?: string | null
          created_at?: string
          direction?: string | null
          id?: number
          sender_name?: string | null
          user_id?: number | null
        }
        Update: {
          body?: string | null
          case_id?: number | null
          case_type?: string | null
          created_at?: string
          direction?: string | null
          id?: number
          sender_name?: string | null
          user_id?: number | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          href: string | null
          id: number
          is_read: boolean
          kind: string
          title: string
          user_id: number
        }
        Insert: {
          body?: string | null
          created_at?: string
          href?: string | null
          id?: number
          is_read?: boolean
          kind: string
          title: string
          user_id: number
        }
        Update: {
          body?: string | null
          created_at?: string
          href?: string | null
          id?: number
          is_read?: boolean
          kind?: string
          title?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          balance: string | null
          created_at: string
          hash_file: string | null
          id: number
          network: string | null
          plan: string | null
          price_usd: number | null
          status: string | null
          tx_hash: string | null
          user_id: number
        }
        Insert: {
          balance?: string | null
          created_at?: string
          hash_file?: string | null
          id?: number
          network?: string | null
          plan?: string | null
          price_usd?: number | null
          status?: string | null
          tx_hash?: string | null
          user_id: number
        }
        Update: {
          balance?: string | null
          created_at?: string
          hash_file?: string | null
          id?: number
          network?: string | null
          plan?: string | null
          price_usd?: number | null
          status?: string | null
          tx_hash?: string | null
          user_id?: number
        }
        Relationships: []
      }
      payout_methods: {
        Row: {
          bank_account: string | null
          bank_name: string | null
          created_at: string
          id: number
          is_default: boolean
          method: string
          network: string | null
          paypal_email: string | null
          user_id: number
          wallet_address: string | null
        }
        Insert: {
          bank_account?: string | null
          bank_name?: string | null
          created_at?: string
          id?: number
          is_default?: boolean
          method: string
          network?: string | null
          paypal_email?: string | null
          user_id: number
          wallet_address?: string | null
        }
        Update: {
          bank_account?: string | null
          bank_name?: string | null
          created_at?: string
          id?: number
          is_default?: boolean
          method?: string
          network?: string | null
          paypal_email?: string | null
          user_id?: number
          wallet_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payout_methods_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_requests: {
        Row: {
          admin_note: string | null
          amount_usd: number
          id: number
          payout_method_id: number | null
          processed_at: string | null
          requested_at: string
          status: string
          trade_account_id: number
          user_id: number
        }
        Insert: {
          admin_note?: string | null
          amount_usd: number
          id?: number
          payout_method_id?: number | null
          processed_at?: string | null
          requested_at?: string
          status?: string
          trade_account_id: number
          user_id: number
        }
        Update: {
          admin_note?: string | null
          amount_usd?: number
          id?: number
          payout_method_id?: number | null
          processed_at?: string | null
          requested_at?: string
          status?: string
          trade_account_id?: number
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "payout_requests_payout_method_id_fkey"
            columns: ["payout_method_id"]
            isOneToOne: false
            referencedRelation: "payout_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_requests_trade_account_id_fkey"
            columns: ["trade_account_id"]
            isOneToOne: false
            referencedRelation: "trade_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      refunds: {
        Row: {
          admin_id: string | null
          amount_usdt: number | null
          created_at: string
          id: number
          order_id: number | null
          processed_at: string | null
          reason: string | null
          status: string | null
          user_id: number
        }
        Insert: {
          admin_id?: string | null
          amount_usdt?: number | null
          created_at?: string
          id?: number
          order_id?: number | null
          processed_at?: string | null
          reason?: string | null
          status?: string | null
          user_id: number
        }
        Update: {
          admin_id?: string | null
          amount_usdt?: number | null
          created_at?: string
          id?: number
          order_id?: number | null
          processed_at?: string | null
          reason?: string | null
          status?: string | null
          user_id?: number
        }
        Relationships: []
      }
      sessions: {
        Row: {
          created_at: string
          expires_at: string
          token: string
          user_id: number
        }
        Insert: {
          created_at?: string
          expires_at: string
          token: string
          user_id: number
        }
        Update: {
          created_at?: string
          expires_at?: string
          token?: string
          user_id?: number
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          body: string | null
          category: string | null
          created_at: string
          id: number
          priority: string | null
          resolved_at: string | null
          status: string | null
          subject: string | null
          user_id: number | null
        }
        Insert: {
          assigned_to?: string | null
          body?: string | null
          category?: string | null
          created_at?: string
          id?: number
          priority?: string | null
          resolved_at?: string | null
          status?: string | null
          subject?: string | null
          user_id?: number | null
        }
        Update: {
          assigned_to?: string | null
          body?: string | null
          category?: string | null
          created_at?: string
          id?: number
          priority?: string | null
          resolved_at?: string | null
          status?: string | null
          subject?: string | null
          user_id?: number | null
        }
        Relationships: []
      }
      trade_accounts: {
        Row: {
          balance: number
          challenge_type: string
          created_at: string
          credentials_emailed_at: string | null
          daily_lock_date: string | null
          daily_loss_pct: number | null
          daily_loss_peak_date: string | null
          daily_loss_peak_pct: number
          eliminated_at: string | null
          elimination_reason: string | null
          equity: number
          id: number
          last_seen_at: string | null
          leverage: number
          max_loss_pct: number | null
          min_equity: number | null
          min_trading_days: number | null
          order_id: number | null
          overall_loss_peak_pct: number
          parent_account_id: number | null
          password_hash: string
          password_plain: string | null
          payouts_taken: number | null
          phase: string
          phase_status: string
          plan: string
          profit_split_pct: number | null
          profit_target_pct: number | null
          refund_eligible: boolean | null
          reject_reason: string | null
          starting_balance: number
          status: string
          trade_id: string
          used_margin: number
          user_id: number
        }
        Insert: {
          balance?: number
          challenge_type?: string
          created_at?: string
          credentials_emailed_at?: string | null
          daily_lock_date?: string | null
          daily_loss_pct?: number | null
          daily_loss_peak_date?: string | null
          daily_loss_peak_pct?: number
          eliminated_at?: string | null
          elimination_reason?: string | null
          equity?: number
          id?: number
          last_seen_at?: string | null
          leverage?: number
          max_loss_pct?: number | null
          min_equity?: number | null
          min_trading_days?: number | null
          order_id?: number | null
          overall_loss_peak_pct?: number
          parent_account_id?: number | null
          password_hash: string
          password_plain?: string | null
          payouts_taken?: number | null
          phase?: string
          phase_status?: string
          plan: string
          profit_split_pct?: number | null
          profit_target_pct?: number | null
          refund_eligible?: boolean | null
          reject_reason?: string | null
          starting_balance?: number
          status?: string
          trade_id: string
          used_margin?: number
          user_id: number
        }
        Update: {
          balance?: number
          challenge_type?: string
          created_at?: string
          credentials_emailed_at?: string | null
          daily_lock_date?: string | null
          daily_loss_pct?: number | null
          daily_loss_peak_date?: string | null
          daily_loss_peak_pct?: number
          eliminated_at?: string | null
          elimination_reason?: string | null
          equity?: number
          id?: number
          last_seen_at?: string | null
          leverage?: number
          max_loss_pct?: number | null
          min_equity?: number | null
          min_trading_days?: number | null
          order_id?: number | null
          overall_loss_peak_pct?: number
          parent_account_id?: number | null
          password_hash?: string
          password_plain?: string | null
          payouts_taken?: number | null
          phase?: string
          phase_status?: string
          plan?: string
          profit_split_pct?: number | null
          profit_target_pct?: number | null
          refund_eligible?: boolean | null
          reject_reason?: string | null
          starting_balance?: number
          status?: string
          trade_id?: string
          used_margin?: number
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "trade_accounts_parent_account_id_fkey"
            columns: ["parent_account_id"]
            isOneToOne: false
            referencedRelation: "trade_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_positions: {
        Row: {
          close_price: number | null
          close_time: string | null
          id: number
          leverage: number
          lots: number
          margin: number
          open_price: number
          open_time: string
          order_type: string
          pair: string
          realized_pnl: number
          side: string
          status: string
          stop_loss: number | null
          take_profit: number | null
          trade_account_id: number
        }
        Insert: {
          close_price?: number | null
          close_time?: string | null
          id?: number
          leverage?: number
          lots: number
          margin?: number
          open_price: number
          open_time?: string
          order_type?: string
          pair: string
          realized_pnl?: number
          side: string
          status?: string
          stop_loss?: number | null
          take_profit?: number | null
          trade_account_id: number
        }
        Update: {
          close_price?: number | null
          close_time?: string | null
          id?: number
          leverage?: number
          lots?: number
          margin?: number
          open_price?: number
          open_time?: string
          order_type?: string
          pair?: string
          realized_pnl?: number
          side?: string
          status?: string
          stop_loss?: number | null
          take_profit?: number | null
          trade_account_id?: number
        }
        Relationships: []
      }
      trade_sessions: {
        Row: {
          created_at: string
          expires_at: string
          token: string
          trade_account_id: number
        }
        Insert: {
          created_at?: string
          expires_at: string
          token: string
          trade_account_id: number
        }
        Update: {
          created_at?: string
          expires_at?: string
          token?: string
          trade_account_id?: number
        }
        Relationships: []
      }
      users: {
        Row: {
          country: string | null
          country_code: string | null
          created_at: string
          email: string
          email_verified: boolean
          id: number
          is_admin: boolean
          name: string | null
          password_hash: string
          phone: string | null
          role: string
          status: string
        }
        Insert: {
          country?: string | null
          country_code?: string | null
          created_at?: string
          email: string
          email_verified?: boolean
          id?: number
          is_admin?: boolean
          name?: string | null
          password_hash: string
          phone?: string | null
          role?: string
          status?: string
        }
        Update: {
          country?: string | null
          country_code?: string | null
          created_at?: string
          email?: string
          email_verified?: boolean
          id?: number
          is_admin?: boolean
          name?: string | null
          password_hash?: string
          phone?: string | null
          role?: string
          status?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          admin_notes: string | null
          amount_usdt: number | null
          id: number
          network: string | null
          processed_at: string | null
          requested_at: string
          status: string | null
          user_id: number
          wallet_address: string | null
        }
        Insert: {
          admin_notes?: string | null
          amount_usdt?: number | null
          id?: number
          network?: string | null
          processed_at?: string | null
          requested_at?: string
          status?: string | null
          user_id: number
          wallet_address?: string | null
        }
        Update: {
          admin_notes?: string | null
          amount_usdt?: number | null
          id?: number
          network?: string | null
          processed_at?: string | null
          requested_at?: string
          status?: string | null
          user_id?: number
          wallet_address?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
