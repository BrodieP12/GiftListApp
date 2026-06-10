/**
 * Hand-maintained Supabase schema types.
 *
 * Mirrors supabase/migrations/*.sql. Once the project is linked you can
 * regenerate this with:
 *   supabase gen types typescript --linked > src/types/database.ts
 * Until then, keep this in sync with the migrations by hand.
 */

type Timestamptz = string;

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string;
          given_name: string;
          family_name: string;
          photo_url: string | null;
          birthday: Timestamptz | null;
          is_premium: boolean;
          is_minor: boolean;
          parent_email: string;
          terms_accepted: boolean;
          privacy_accepted: boolean;
          acceptance_date: Timestamptz | null;
          is_eu_user: boolean;
          gdpr_applies: boolean;
          accepted_data_processing: boolean;
          created_at: Timestamptz;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string;
          given_name?: string;
          family_name?: string;
          photo_url?: string | null;
          birthday?: Timestamptz | null;
          is_premium?: boolean;
          is_minor?: boolean;
          parent_email?: string;
          terms_accepted?: boolean;
          privacy_accepted?: boolean;
          acceptance_date?: Timestamptz | null;
          is_eu_user?: boolean;
          gdpr_applies?: boolean;
          accepted_data_processing?: boolean;
          created_at?: Timestamptz;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
        Relationships: [];
      };
      lists: {
        Row: {
          id: string;
          owner_id: string;
          title: string;
          is_private: boolean;
          share_code: string | null;
          created_at: Timestamptz;
          updated_at: Timestamptz | null;
        };
        Insert: {
          id?: string;
          owner_id: string;
          title: string;
          is_private?: boolean;
          share_code?: string | null;
          created_at?: Timestamptz;
          updated_at?: Timestamptz | null;
        };
        Update: Partial<Database['public']['Tables']['lists']['Insert']>;
        Relationships: [];
      };
      list_members: {
        Row: {
          list_id: string;
          user_id: string;
          joined_at: Timestamptz;
        };
        Insert: {
          list_id: string;
          user_id: string;
          joined_at?: Timestamptz;
        };
        Update: Partial<Database['public']['Tables']['list_members']['Insert']>;
        Relationships: [];
      };
      items: {
        Row: {
          id: string;
          list_id: string;
          owner_id: string;
          name: string;
          description: string;
          price: number | null;
          image_uri: string | null;
          url: string | null;
          substitutions: boolean;
          created_at: Timestamptz;
          updated_at: Timestamptz | null;
        };
        Insert: {
          id?: string;
          list_id: string;
          owner_id: string;
          name: string;
          description?: string;
          price?: number | null;
          image_uri?: string | null;
          url?: string | null;
          substitutions?: boolean;
          created_at?: Timestamptz;
          updated_at?: Timestamptz | null;
        };
        Update: Partial<Database['public']['Tables']['items']['Insert']>;
        Relationships: [];
      };
      claims: {
        Row: {
          item_id: string;
          list_id: string;
          claimed_by: string;
          list_owner_id: string;
          claimed_at: Timestamptz;
        };
        Insert: {
          item_id: string;
          list_id: string;
          claimed_by: string;
          list_owner_id: string;
          claimed_at?: Timestamptz;
        };
        Update: Partial<Database['public']['Tables']['claims']['Insert']>;
        Relationships: [];
      };
      feedback: {
        Row: {
          id: string;
          user_id: string;
          user_email: string;
          text: string;
          type: string;
          is_anonymous: boolean;
          platform: string | null;
          created_at: Timestamptz;
        };
        Insert: {
          id?: string;
          user_id: string;
          user_email: string;
          text: string;
          type?: string;
          is_anonymous?: boolean;
          platform?: string | null;
          created_at?: Timestamptz;
        };
        Update: Partial<Database['public']['Tables']['feedback']['Insert']>;
        Relationships: [];
      };
      app_config: {
        Row: { key: string; value: Json; updated_at: Timestamptz };
        Insert: { key: string; value: Json; updated_at?: Timestamptz };
        Update: Partial<Database['public']['Tables']['app_config']['Insert']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      join_list_by_code: {
        Args: { p_code: string };
        Returns: string;
      };
      has_list_access: {
        Args: { p_list: string };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
