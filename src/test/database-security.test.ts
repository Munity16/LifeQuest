import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/202607170002_secure_server_mutations.sql"), "utf8");

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
