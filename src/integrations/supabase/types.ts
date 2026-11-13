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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      cases: {
        Row: {
          buyer: string | null
          competitors: string | null
          distance_to_market: string | null
          facts: Json | null
          id: string
          model: string | null
          person_id: string
          product: string | null
          risks: string | null
          scan_id: string
          unverified: string | null
          validated: boolean
        }
        Insert: {
          buyer?: string | null
          competitors?: string | null
          distance_to_market?: string | null
          facts?: Json | null
          id?: string
          model?: string | null
          person_id: string
          product?: string | null
          risks?: string | null
          scan_id: string
          unverified?: string | null
          validated?: boolean
        }
        Update: {
          buyer?: string | null
          competitors?: string | null
          distance_to_market?: string | null
          facts?: Json | null
          id?: string
          model?: string | null
          person_id?: string
          product?: string | null
          risks?: string | null
          scan_id?: string
          unverified?: string | null
          validated?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "cases_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence: {
        Row: {
          event_date: string | null
          id: string
          label: string | null
          link_confidence: string | null
          max_points: number | null
          person_id: string
          points: number | null
          retrieved_at: string | null
          scan_id: string
          score_group: string | null
          signal_type: string | null
          source_url: string | null
          status: string | null
          value: string | null
        }
        Insert: {
          event_date?: string | null
          id?: string
          label?: string | null
          link_confidence?: string | null
          max_points?: number | null
          person_id: string
          points?: number | null
          retrieved_at?: string | null
          scan_id: string
          score_group?: string | null
          signal_type?: string | null
          source_url?: string | null
          status?: string | null
          value?: string | null
        }
        Update: {
          event_date?: string | null
          id?: string
          label?: string | null
          link_confidence?: string | null
          max_points?: number | null
          person_id?: string
          points?: number | null
          retrieved_at?: string | null
          scan_id?: string
          score_group?: string | null
          signal_type?: string | null
          source_url?: string | null
          status?: string | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          applied: string | null
          doi: string | null
          fit: number | null
          id: string
          item_date: string | null
          limited_info: boolean
          raw: Json | null
          reason: string | null
          scan_id: string
          source: string
          source_id: string | null
          summary: string | null
          title: string | null
          url: string | null
          use_case: string | null
          verdict: string | null
        }
        Insert: {
          applied?: string | null
          doi?: string | null
          fit?: number | null
          id?: string
          item_date?: string | null
          limited_info?: boolean
          raw?: Json | null
          reason?: string | null
          scan_id: string
          source: string
          source_id?: string | null
          summary?: string | null
          title?: string | null
          url?: string | null
          use_case?: string | null
          verdict?: string | null
        }
        Update: {
          applied?: string | null
          doi?: string | null
          fit?: number | null
          id?: string
          item_date?: string | null
          limited_info?: boolean
          raw?: Json | null
          reason?: string | null
          scan_id?: string
          source?: string
          source_id?: string | null
          summary?: string | null
          title?: string | null
          url?: string | null
          use_case?: string | null
          verdict?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "items_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          first_year: number | null
          id: string
          identity_confidence: string | null
          identity_reasons: string[] | null
          is_sample: boolean
          name: string
          openalex_id: string | null
          school: string | null
          tracks: string[]
        }
        Insert: {
          first_year?: number | null
          id?: string
          identity_confidence?: string | null
          identity_reasons?: string[] | null
          is_sample?: boolean
          name: string
          openalex_id?: string | null
          school?: string | null
          tracks?: string[]
        }
        Update: {
          first_year?: number | null
          id?: string
          identity_confidence?: string | null
          identity_reasons?: string[] | null
          is_sample?: boolean
          name?: string
          openalex_id?: string | null
          school?: string | null
          tracks?: string[]
        }
        Relationships: []
      }
      person_items: {
        Row: {
          confidence: string | null
          id: string
          item_id: string
          person_id: string
          reasons: string[] | null
          role: string | null
        }
        Insert: {
          confidence?: string | null
          id?: string
          item_id: string
          person_id: string
          reasons?: string[] | null
          role?: string | null
        }
        Update: {
          confidence?: string | null
          id?: string
          item_id?: string
          person_id?: string
          reasons?: string[] | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "person_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_items_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      picks: {
        Row: {
          action: string | null
          below_bar_reason: string | null
          id: string
          in_digest: boolean
          intro_paths: Json | null
          lane: string | null
          lane_reason: string | null
          person_id: string
          propensity_coverage: string | null
          propensity_score: number | null
          rank: number | null
          research_coverage: string | null
          research_score: number | null
          scan_id: string
          timing_coverage: string | null
          timing_score: number | null
          why: string | null
        }
        Insert: {
          action?: string | null
          below_bar_reason?: string | null
          id?: string
          in_digest?: boolean
          intro_paths?: Json | null
          lane?: string | null
          lane_reason?: string | null
          person_id: string
          propensity_coverage?: string | null
          propensity_score?: number | null
          rank?: number | null
          research_coverage?: string | null
          research_score?: number | null
          scan_id: string
          timing_coverage?: string | null
          timing_score?: number | null
          why?: string | null
        }
        Update: {
          action?: string | null
          below_bar_reason?: string | null
          id?: string
          in_digest?: boolean
          intro_paths?: Json | null
          lane?: string | null
          lane_reason?: string | null
          person_id?: string
          propensity_coverage?: string | null
          propensity_score?: number | null
          rank?: number | null
          research_coverage?: string | null
          research_score?: number | null
          scan_id?: string
          timing_coverage?: string | null
          timing_score?: number | null
          why?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "picks_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picks_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
        ]
      }
      scans: {
        Row: {
          counts: Json
          error: string | null
          finished_at: string | null
          id: string
          is_sample: boolean
          models: Json | null
          position: Json | null
          rules_version: string | null
          stage: string | null
          started_at: string | null
          status: string
          thesis_id: string
        }
        Insert: {
          counts?: Json
          error?: string | null
          finished_at?: string | null
          id?: string
          is_sample?: boolean
          models?: Json | null
          position?: Json | null
          rules_version?: string | null
          stage?: string | null
          started_at?: string | null
          status?: string
          thesis_id: string
        }
        Update: {
          counts?: Json
          error?: string | null
          finished_at?: string | null
          id?: string
          is_sample?: boolean
          models?: Json | null
          position?: Json | null
          rules_version?: string | null
          stage?: string | null
          started_at?: string | null
          status?: string
          thesis_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scans_thesis_id_fkey"
            columns: ["thesis_id"]
            isOneToOne: false
            referencedRelation: "theses"
            referencedColumns: ["id"]
          },
        ]
      }
      theses: {
        Row: {
          created_at: string
          fields: string[] | null
          id: string
          keywords: string[] | null
          lane_sizes: Json
          school_ids: string[]
          text: string
          window_days: number
        }
        Insert: {
          created_at?: string
          fields?: string[] | null
          id?: string
          keywords?: string[] | null
          lane_sizes?: Json
          school_ids?: string[]
          text: string
          window_days?: number
        }
        Update: {
          created_at?: string
          fields?: string[] | null
          id?: string
          keywords?: string[] | null
          lane_sizes?: Json
          school_ids?: string[]
          text?: string
          window_days?: number
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
