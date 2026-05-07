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
      categories: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      feed_validation_runs: {
        Row: {
          created_at: string
          id: string
          report: Json
          total_errors: number
          total_warnings: number
        }
        Insert: {
          created_at?: string
          id?: string
          report?: Json
          total_errors?: number
          total_warnings?: number
        }
        Update: {
          created_at?: string
          id?: string
          report?: Json
          total_errors?: number
          total_warnings?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          alert_day: string
          category_slug: string | null
          created_at: string
          excerpt: string | null
          expires_at: string
          id: string
          image_url: string | null
          kind: string
          post_id: string | null
          reason: string | null
          slug: string
          title: string
          views_at_alert: number | null
        }
        Insert: {
          alert_day?: string
          category_slug?: string | null
          created_at?: string
          excerpt?: string | null
          expires_at?: string
          id?: string
          image_url?: string | null
          kind: string
          post_id?: string | null
          reason?: string | null
          slug: string
          title: string
          views_at_alert?: number | null
        }
        Update: {
          alert_day?: string
          category_slug?: string | null
          created_at?: string
          excerpt?: string | null
          expires_at?: string
          id?: string
          image_url?: string | null
          kind?: string
          post_id?: string | null
          reason?: string | null
          slug?: string
          title?: string
          views_at_alert?: number | null
        }
        Relationships: []
      }
      posts: {
        Row: {
          author: string
          category_slug: string
          content: string
          created_at: string
          excerpt: string
          faq: Json | null
          featured_image_alt: string | null
          featured_image_url: string | null
          id: string
          key_takeaways: string[] | null
          keywords: string[] | null
          meta_description: string
          meta_title: string
          published_at: string
          reading_minutes: number | null
          slug: string
          status: string
          title: string
          updated_at: string
          views: number
        }
        Insert: {
          author?: string
          category_slug: string
          content: string
          created_at?: string
          excerpt: string
          faq?: Json | null
          featured_image_alt?: string | null
          featured_image_url?: string | null
          id?: string
          key_takeaways?: string[] | null
          keywords?: string[] | null
          meta_description: string
          meta_title: string
          published_at?: string
          reading_minutes?: number | null
          slug: string
          status?: string
          title: string
          updated_at?: string
          views?: number
        }
        Update: {
          author?: string
          category_slug?: string
          content?: string
          created_at?: string
          excerpt?: string
          faq?: Json | null
          featured_image_alt?: string | null
          featured_image_url?: string | null
          id?: string
          key_takeaways?: string[] | null
          keywords?: string[] | null
          meta_description?: string
          meta_title?: string
          published_at?: string
          reading_minutes?: number | null
          slug?: string
          status?: string
          title?: string
          updated_at?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "posts_category_slug_fkey"
            columns: ["category_slug"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["slug"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_post_views: { Args: { post_slug: string }; Returns: undefined }
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
