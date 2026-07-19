export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Table<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: Table<
        { id: string; display_name: string | null; avatar_url: string | null; appearance_preferences: Json; total_xp: number; current_level: number; created_at: string; updated_at: string },
        { id: string; display_name?: string | null; avatar_url?: string | null; appearance_preferences?: Json; total_xp?: number; current_level?: number; created_at?: string; updated_at?: string },
        { display_name?: string | null; avatar_url?: string | null; appearance_preferences?: Json; updated_at?: string }
      >;
      campaigns: Table<
        { id: string; user_id: string; generation_key: string | null; goal: string; daily_minutes: number; main_obstacle: string; difficulty: string; campaign_name: string; hero_name: string; enemy_name: string; enemy_description: string | null; story: string; enemy_max_health: number; enemy_current_health: number; status: string; created_at: string; updated_at: string },
        { id?: string; user_id: string; generation_key?: string | null; goal: string; daily_minutes: number; main_obstacle: string; difficulty: string; campaign_name: string; hero_name: string; enemy_name: string; enemy_description?: string | null; story: string; enemy_max_health?: number; enemy_current_health?: number; status?: string; created_at?: string; updated_at?: string },
        { generation_key?: string | null; status?: string; updated_at?: string }
      >;
      quests: Table<
        { id: string; campaign_id: string; user_id: string; day_number: number; sequence_number: number; title: string; story_intro: string | null; description: string; difficulty: string; estimated_minutes: number; xp_reward: number; enemy_damage: number; proof_type: string; success_requirements: Json; status: string; is_adaptive: boolean; completed_at: string | null; created_at: string; updated_at: string },
        { id?: string; campaign_id: string; user_id: string; day_number: number; sequence_number: number; title: string; story_intro?: string | null; description: string; difficulty: string; estimated_minutes: number; xp_reward: number; enemy_damage: number; proof_type?: string; success_requirements: Json; status?: string; is_adaptive?: boolean; completed_at?: string | null; created_at?: string; updated_at?: string },
        { status?: string; completed_at?: string | null; updated_at?: string }
      >;
      quest_submissions: Table<
        { id: string; quest_id: string; campaign_id: string; user_id: string; storage_path: string; verification_status: string; verification_confidence: number | null; verification_reason: string | null; model_used: string | null; xp_awarded: number; enemy_damage_awarded: number; created_at: string; verified_at: string | null },
        { id?: string; quest_id: string; campaign_id: string; user_id: string; storage_path: string; verification_status?: string; verification_confidence?: number | null; verification_reason?: string | null; model_used?: string | null; xp_awarded?: number; enemy_damage_awarded?: number; created_at?: string; verified_at?: string | null },
        { verification_status?: string; verification_confidence?: number | null; verification_reason?: string | null; model_used?: string | null; verified_at?: string | null }
      >;
      progress_events: Table<
        { id: string; user_id: string; campaign_id: string; quest_id: string | null; event_type: string; xp_change: number; enemy_health_change: number; metadata: Json | null; created_at: string },
        { id?: string; user_id: string; campaign_id: string; quest_id?: string | null; event_type: string; xp_change?: number; enemy_health_change?: number; metadata?: Json | null; created_at?: string },
        never
      >;
    };
    Views: Record<string, never>;
    Functions: {
      create_campaign_with_quests: {
        Args: { p_user_id: string; p_generation_key: string; p_goal: string; p_daily_minutes: number; p_main_obstacle: string; p_difficulty: string; p_generated: Json };
        Returns: string;
      };
      complete_quest: {
        Args: { p_submission_id: string; p_confidence: number; p_reason: string; p_model_used: string };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
