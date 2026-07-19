import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/202607170002_secure_server_mutations.sql"), "utf8");
const initialMigration = readFileSync(resolve(process.cwd(), "supabase/migrations/202607170001_initial_schema.sql"), "utf8");
const appearanceMigration = readFileSync(resolve(process.cwd(), "supabase/migrations/202607190003_profile_appearance.sql"), "utf8");
const hardeningMigration = readFileSync(resolve(process.cwd(), "supabase/migrations/202607190004_production_hardening.sql"), "utf8");

describe("secure database mutation migration", () => {
  it("restricts campaign creation and progression to the service role", () => {
    expect(migration).toContain("auth.role() <> 'service_role'");
    expect(migration).toMatch(/revoke all on function public\.complete_quest[\s\S]+from public, anon, authenticated/i);
    expect(migration).toMatch(/grant execute on function public\.complete_quest[\s\S]+to service_role/i);
  });

  it("keeps campaign creation atomic and idempotent", () => {
    expect(migration).toContain("campaigns_user_generation_key_key unique");
    expect(migration).toContain("on conflict (user_id, generation_key) do nothing");
    expect(migration).toContain("jsonb_array_elements(p_generated -> 'quests') with ordinality");
  });

  it("locks reward-bearing rows and clamps applied damage", () => {
    expect(migration).toMatch(/quest_submissions[\s\S]+for update/i);
    expect(migration).toMatch(/public\.quests[\s\S]+for update/i);
    expect(migration).toContain("least(v_quest.enemy_damage, v_campaign.enemy_current_health)");
    expect(migration).toContain("v_quest.status = 'completed' or v_submission.xp_awarded > 0");
  });
});

describe("profile appearance migration", () => {
  it("stores only JSON objects behind the existing own-profile RLS policy", () => {
    expect(appearanceMigration).toContain("jsonb_typeof(appearance_preferences) = 'object'");
    expect(appearanceMigration).toContain("grant update (appearance_preferences)");
    expect(initialMigration).toMatch(/profiles_update_own[\s\S]+auth\.uid\(\) = id[\s\S]+auth\.uid\(\) = id/i);
  });
});

describe("production hardening migration", () => {
  it("keeps rate limits and telemetry server-only", () => {
    expect(hardeningMigration).toContain("auth.role() <> 'service_role'");
    expect(hardeningMigration).toMatch(/revoke all on public\.api_rate_limits, public\.operational_events from public, anon, authenticated/i);
    expect(hardeningMigration).toMatch(/grant execute on function public\.consume_api_rate_limit[\s\S]+to service_role/i);
  });

  it("supports proof deletion receipts without deleting progression", () => {
    expect(hardeningMigration).toContain("alter column storage_path drop not null");
    expect(hardeningMigration).toContain("proof_deleted_at timestamptz");
    expect(hardeningMigration).not.toMatch(/delete from public\.progress_events/i);
  });
});
