begin;

-- Verification state and reusable privacy-safe receipts.
alter table public.quest_submissions
  drop constraint if exists quest_submissions_verification_status_check;

update public.quest_submissions
set verification_status = 'failed'
where verification_status = 'error';

alter table public.quest_submissions
  add constraint quest_submissions_verification_status_check
    check (verification_status in ('pending', 'processing', 'accepted', 'rejected', 'failed')),
  add column if not exists verification_result jsonb,
  add column if not exists safety_status text,
  add column if not exists trace_id uuid,
  add column if not exists schema_validated boolean,
  add column if not exists processing_token uuid,
  add column if not exists processing_started_at timestamptz,
  add column if not exists last_error_code text,
  add column if not exists updated_at timestamptz not null default now();

-- Preserve terminal decisions made before structured receipts existed.
update public.quest_submissions as submission
set verification_result = jsonb_build_object(
  'submissionId', submission.id,
  'verifiedAt', coalesce(submission.verified_at, submission.created_at),
  'verified', submission.verification_status = 'accepted',
  'duplicate', false,
  'confidence', coalesce(
    submission.verification_confidence,
    case when submission.verification_status = 'accepted' then 1 else 0 end
  ),
  'reason', coalesce(
    nullif(submission.verification_reason, ''),
    case
      when submission.verification_status = 'accepted' then 'Accepted before structured verification receipts were introduced.'
      else 'Rejected before structured verification receipts were introduced.'
    end
  ),
  'requirementsAssessment', jsonb_build_array(jsonb_build_object(
    'requirement', 'Legacy proof assessment',
    'satisfied', submission.verification_status = 'accepted',
    'explanation', 'This terminal decision was retained during the V2 receipt migration.'
  )),
  'xpAwarded', submission.xp_awarded,
  'enemyDamage', submission.enemy_damage_awarded,
  'totalXp', coalesce((select profile.total_xp from public.profiles profile where profile.id = submission.user_id), 0),
  'currentLevel', coalesce((select profile.current_level from public.profiles profile where profile.id = submission.user_id), 1),
  'enemyCurrentHealth', coalesce((select campaign.enemy_current_health from public.campaigns campaign where campaign.id = submission.campaign_id), 100),
  'levelledUp', false,
  'adaptiveQuestCreated', false
)
where submission.verification_status in ('accepted', 'rejected')
  and submission.verification_result is null;

alter table public.quest_submissions
  drop constraint if exists quest_submissions_verification_result_check,
  add constraint quest_submissions_verification_result_check
    check (verification_result is null or jsonb_typeof(verification_result) = 'object'),
  drop constraint if exists quest_submissions_safety_status_check,
  add constraint quest_submissions_safety_status_check
    check (safety_status is null or safety_status in ('passed', 'flagged'));

drop trigger if exists quest_submissions_set_updated_at on public.quest_submissions;
create trigger quest_submissions_set_updated_at
before update on public.quest_submissions
for each row execute function public.set_updated_at();

create index if not exists submissions_processing_idx
  on public.quest_submissions(processing_started_at)
  where verification_status = 'processing';

create or replace function public.claim_quest_verification(
  p_submission_id uuid,
  p_user_id uuid,
  p_trace_id uuid,
  p_stale_after_seconds integer default 300
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_submission public.quest_submissions%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if auth.role() <> 'service_role' then
    raise exception 'Server authorization required' using errcode = '42501';
  end if;
  if p_stale_after_seconds not between 30 and 1800 then
    raise exception 'Invalid verification lease' using errcode = '22023';
  end if;

  select * into v_submission
  from public.quest_submissions
  where id = p_submission_id and user_id = p_user_id
  for update;

  if not found then
    raise exception 'Submission not found' using errcode = 'P0002';
  end if;

  if v_submission.verification_status in ('accepted', 'rejected') then
    return jsonb_build_object(
      'state', v_submission.verification_status,
      'claimed', false,
      'result', v_submission.verification_result
    );
  end if;

  if v_submission.verification_status = 'processing'
     and v_submission.processing_started_at > v_now - make_interval(secs => p_stale_after_seconds) then
    return jsonb_build_object(
      'state', 'processing',
      'claimed', false,
      'result', v_submission.verification_result
    );
  end if;

  update public.quest_submissions
  set verification_status = 'processing',
      processing_token = p_trace_id,
      processing_started_at = v_now,
      trace_id = p_trace_id,
      last_error_code = null
  where id = p_submission_id;

  return jsonb_build_object(
    'state', 'processing',
    'claimed', true,
    'processingToken', p_trace_id,
    'result', v_submission.verification_result
  );
end;
$$;

revoke all on function public.claim_quest_verification(uuid, uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.claim_quest_verification(uuid, uuid, uuid, integer)
  to service_role;

create or replace function public.save_quest_verification_assessment(
  p_submission_id uuid,
  p_processing_token uuid,
  p_result jsonb,
  p_safety_status text,
  p_model_used text,
  p_schema_validated boolean
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Server authorization required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_result) <> 'object'
     or p_safety_status not in ('passed', 'flagged')
     or char_length(p_model_used) not between 1 and 120 then
    raise exception 'Invalid verification assessment' using errcode = '22023';
  end if;

  update public.quest_submissions
  set verification_result = p_result,
      safety_status = p_safety_status,
      model_used = p_model_used,
      schema_validated = p_schema_validated
  where id = p_submission_id
    and verification_status = 'processing'
    and processing_token = p_processing_token;

  if not found then
    raise exception 'Verification lease is no longer active' using errcode = '40001';
  end if;
  return true;
end;
$$;

revoke all on function public.save_quest_verification_assessment(uuid, uuid, jsonb, text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.save_quest_verification_assessment(uuid, uuid, jsonb, text, text, boolean)
  to service_role;

create or replace function public.finalize_quest_verification(
  p_submission_id uuid,
  p_processing_token uuid,
  p_terminal_status text,
  p_result jsonb,
  p_error_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_submission public.quest_submissions%rowtype;
  v_profile public.profiles%rowtype;
  v_campaign public.campaigns%rowtype;
  v_public_result jsonb;
  v_verified_at timestamptz := clock_timestamp();
begin
  if auth.role() <> 'service_role' then
    raise exception 'Server authorization required' using errcode = '42501';
  end if;
  if p_terminal_status not in ('rejected', 'failed') then
    raise exception 'Invalid terminal verification state' using errcode = '22023';
  end if;
  if p_terminal_status = 'rejected' and jsonb_typeof(p_result) <> 'object' then
    raise exception 'Rejected verification requires a public result' using errcode = '22023';
  end if;

  select * into v_submission
  from public.quest_submissions
  where id = p_submission_id
  for update;

  if not found then
    raise exception 'Submission not found' using errcode = 'P0002';
  end if;

  if v_submission.verification_status in ('accepted', 'rejected') then
    return coalesce(v_submission.verification_result, '{}'::jsonb);
  end if;

  if v_submission.verification_status <> 'processing'
     or v_submission.processing_token <> p_processing_token then
    raise exception 'Verification lease is no longer active' using errcode = '40001';
  end if;

  if p_terminal_status = 'failed' then
    update public.quest_submissions
    set verification_status = 'failed',
        last_error_code = left(coalesce(p_error_code, 'VERIFICATION_FAILED'), 80),
        processing_token = null,
        processing_started_at = null
    where id = p_submission_id;
    return jsonb_build_object('state', 'failed');
  end if;

  select * into v_profile from public.profiles where id = v_submission.user_id;
  select * into v_campaign from public.campaigns where id = v_submission.campaign_id;

  v_public_result := p_result || jsonb_build_object(
    'submissionId', v_submission.id,
    'verifiedAt', v_verified_at,
    'verified', false,
    'duplicate', false,
    'xpAwarded', 0,
    'enemyDamage', 0,
    'totalXp', coalesce(v_profile.total_xp, 0),
    'currentLevel', coalesce(v_profile.current_level, 1),
    'enemyCurrentHealth', coalesce(v_campaign.enemy_current_health, 100),
    'levelledUp', false,
    'adaptiveQuestCreated', false
  );

  update public.quest_submissions
  set verification_status = 'rejected',
      verification_result = v_public_result,
      verification_confidence = nullif(p_result ->> 'confidence', '')::numeric,
      verification_reason = left(p_result ->> 'reason', 500),
      verified_at = v_verified_at,
      processing_token = null,
      processing_started_at = null,
      last_error_code = null
  where id = p_submission_id;

  return v_public_result;
end;
$$;

revoke all on function public.finalize_quest_verification(uuid, uuid, text, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.finalize_quest_verification(uuid, uuid, text, jsonb, text)
  to service_role;

-- Exact seven-day campaign structure.
alter table public.quests
  add column if not exists is_boss_quest boolean not null default false,
  add column if not exists generation_contract_version smallint not null default 1;

create unique index if not exists quests_core_day_unique_idx
  on public.quests(campaign_id, day_number)
  where is_adaptive = false and generation_contract_version = 2;

create unique index if not exists quests_core_title_unique_idx
  on public.quests(campaign_id, lower(title))
  where is_adaptive = false and generation_contract_version = 2;

alter table public.quests
  drop constraint if exists quests_generation_contract_version_check,
  add constraint quests_generation_contract_version_check
    check (generation_contract_version in (1, 2)),
  drop constraint if exists quests_core_shape_check,
  add constraint quests_core_shape_check check (
    is_adaptive
    or generation_contract_version <> 2
    or (
      day_number between 1 and 7
      and sequence_number between 1 and 7
      and is_boss_quest = (day_number = 7)
    )
  );

-- A generation key is claimed before any paid model call.
create table if not exists public.campaign_generation_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  generation_key uuid not null,
  status text not null default 'processing'
    check (status in ('processing', 'succeeded', 'failed')),
  campaign_id uuid references public.campaigns(id) on delete set null,
  processing_token uuid,
  processing_started_at timestamptz,
  attempt_count integer not null default 1 check (attempt_count between 1 and 10),
  error_code text check (error_code is null or char_length(error_code) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, generation_key)
);

create index if not exists campaign_generation_requests_user_status_idx
  on public.campaign_generation_requests(user_id, status, updated_at desc);

alter table public.campaign_generation_requests enable row level security;
revoke all on public.campaign_generation_requests from public, anon, authenticated;
grant select, insert, update on public.campaign_generation_requests to service_role;

drop trigger if exists campaign_generation_requests_set_updated_at
  on public.campaign_generation_requests;
create trigger campaign_generation_requests_set_updated_at
before update on public.campaign_generation_requests
for each row execute function public.set_updated_at();

create or replace function public.claim_campaign_generation(
  p_user_id uuid,
  p_generation_key uuid,
  p_processing_token uuid,
  p_stale_after_seconds integer default 300
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.campaign_generation_requests%rowtype;
  v_campaign_id uuid;
  v_now timestamptz := clock_timestamp();
begin
  if auth.role() <> 'service_role' then
    raise exception 'Server authorization required' using errcode = '42501';
  end if;

  select id into v_campaign_id
  from public.campaigns
  where user_id = p_user_id and generation_key = p_generation_key;

  if v_campaign_id is not null then
    insert into public.campaign_generation_requests (
      user_id, generation_key, status, campaign_id
    ) values (
      p_user_id, p_generation_key, 'succeeded', v_campaign_id
    )
    on conflict (user_id, generation_key) do update
    set status = 'succeeded', campaign_id = excluded.campaign_id,
        processing_token = null, processing_started_at = null, error_code = null;

    return jsonb_build_object(
      'state', 'succeeded',
      'claimed', false,
      'campaignId', v_campaign_id
    );
  end if;

  insert into public.campaign_generation_requests (
    user_id, generation_key, status, processing_token, processing_started_at
  ) values (
    p_user_id, p_generation_key, 'processing', p_processing_token, v_now
  )
  on conflict (user_id, generation_key) do nothing;

  select * into v_request
  from public.campaign_generation_requests
  where user_id = p_user_id and generation_key = p_generation_key
  for update;

  if v_request.status = 'succeeded' then
    return jsonb_build_object(
      'state', 'succeeded',
      'claimed', false,
      'campaignId', v_request.campaign_id
    );
  end if;

  if v_request.status = 'processing'
     and v_request.processing_token = p_processing_token then
    return jsonb_build_object(
      'state', 'processing',
      'claimed', true,
      'processingToken', p_processing_token
    );
  end if;

  if v_request.status = 'processing'
     and v_request.processing_started_at > v_now - make_interval(secs => p_stale_after_seconds) then
    return jsonb_build_object('state', 'processing', 'claimed', false);
  end if;

  if v_request.attempt_count >= 10 then
    raise exception 'Generation retry limit reached' using errcode = '22023';
  end if;

  update public.campaign_generation_requests
  set status = 'processing',
      processing_token = p_processing_token,
      processing_started_at = v_now,
      attempt_count = attempt_count + 1,
      error_code = null
  where id = v_request.id;

  return jsonb_build_object(
    'state', 'processing',
    'claimed', true,
    'processingToken', p_processing_token
  );
end;
$$;

revoke all on function public.claim_campaign_generation(uuid, uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.claim_campaign_generation(uuid, uuid, uuid, integer)
  to service_role;

create or replace function public.fail_campaign_generation(
  p_user_id uuid,
  p_generation_key uuid,
  p_processing_token uuid,
  p_error_code text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Server authorization required' using errcode = '42501';
  end if;

  update public.campaign_generation_requests
  set status = 'failed',
      error_code = left(coalesce(p_error_code, 'GENERATION_FAILED'), 80),
      processing_token = null,
      processing_started_at = null
  where user_id = p_user_id
    and generation_key = p_generation_key
    and status = 'processing'
    and processing_token = p_processing_token;
  return found;
end;
$$;

revoke all on function public.fail_campaign_generation(uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.fail_campaign_generation(uuid, uuid, uuid, text)
  to service_role;

create or replace function public.create_campaign_with_quests(
  p_user_id uuid,
  p_generation_key uuid,
  p_goal text,
  p_daily_minutes integer,
  p_main_obstacle text,
  p_difficulty text,
  p_generated jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_campaign_id uuid;
  v_quest jsonb;
  v_ordinality bigint;
  v_title text;
  v_titles text[] := array[]::text[];
  v_xp integer;
  v_damage integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Server authorization required' using errcode = '42501';
  end if;
  if p_user_id is null or p_generation_key is null then
    raise exception 'User and generation key are required' using errcode = '22023';
  end if;
  if jsonb_typeof(p_generated) <> 'object'
     or jsonb_typeof(p_generated -> 'quests') <> 'array'
     or jsonb_array_length(p_generated -> 'quests') <> 7 then
    raise exception 'A campaign must contain exactly seven core quests' using errcode = '22023';
  end if;

  for v_quest, v_ordinality in
    select value, ordinality
    from jsonb_array_elements(p_generated -> 'quests') with ordinality
  loop
    v_title := lower(trim(v_quest ->> 'title'));
    v_xp := (v_quest ->> 'xpReward')::integer;
    v_damage := (v_quest ->> 'enemyDamage')::integer;

    if (v_quest ->> 'dayNumber')::integer <> v_ordinality
       or (v_quest ->> 'sequenceNumber')::integer <> v_ordinality
       or (v_quest ->> 'estimatedMinutes')::integer > p_daily_minutes
       or coalesce(v_quest ->> 'proofType', '') <> 'image'
       or v_title = any(v_titles)
       or (v_ordinality = 7) <> coalesce((v_quest ->> 'isBossQuest')::boolean, false)
       or jsonb_typeof(v_quest -> 'successRequirements') <> 'array'
       or jsonb_array_length(v_quest -> 'successRequirements') not between 1 and 5 then
      raise exception 'Generated quest % violates the seven-day campaign contract', v_ordinality
        using errcode = '22023';
    end if;

    if (v_quest ->> 'difficulty') = 'gentle'
       and (v_xp not between 15 and 25 or v_damage not between 8 and 12) then
      raise exception 'Gentle reward is outside its allowed band' using errcode = '22023';
    elsif (v_quest ->> 'difficulty') = 'balanced'
       and (v_xp not between 25 and 40 or v_damage not between 12 and 18) then
      raise exception 'Balanced reward is outside its allowed band' using errcode = '22023';
    elsif (v_quest ->> 'difficulty') = 'challenging'
       and (v_xp not between 40 and 60 or v_damage not between 18 and 25) then
      raise exception 'Challenging reward is outside its allowed band' using errcode = '22023';
    elsif (v_quest ->> 'difficulty') not in ('gentle', 'balanced', 'challenging') then
      raise exception 'Unsupported quest difficulty' using errcode = '22023';
    end if;

    v_titles := array_append(v_titles, v_title);
  end loop;

  insert into public.campaigns (
    user_id, generation_key, goal, daily_minutes, main_obstacle, difficulty,
    campaign_name, hero_name, enemy_name, enemy_description, story
  ) values (
    p_user_id, p_generation_key, p_goal, p_daily_minutes, p_main_obstacle,
    p_difficulty, p_generated ->> 'campaignName', p_generated ->> 'heroName',
    p_generated ->> 'enemyName', p_generated ->> 'enemyDescription',
    p_generated ->> 'story'
  )
  on conflict (user_id, generation_key) do nothing
  returning id into v_campaign_id;

  if v_campaign_id is null then
    select id into v_campaign_id
    from public.campaigns
    where user_id = p_user_id and generation_key = p_generation_key;
  else
    for v_quest, v_ordinality in
      select value, ordinality
      from jsonb_array_elements(p_generated -> 'quests') with ordinality
    loop
      insert into public.quests (
        campaign_id, user_id, day_number, sequence_number, title, story_intro,
        description, difficulty, estimated_minutes, xp_reward, enemy_damage,
        proof_type, success_requirements, status, is_boss_quest,
        generation_contract_version
      ) values (
        v_campaign_id, p_user_id, v_ordinality, v_ordinality,
        v_quest ->> 'title', v_quest ->> 'storyIntro',
        v_quest ->> 'description', v_quest ->> 'difficulty',
        (v_quest ->> 'estimatedMinutes')::integer,
        (v_quest ->> 'xpReward')::integer,
        (v_quest ->> 'enemyDamage')::integer,
        v_quest ->> 'proofType', v_quest -> 'successRequirements',
        case when v_ordinality = 1 then 'available' else 'locked' end,
        (v_quest ->> 'isBossQuest')::boolean, 2
      );
    end loop;
  end if;

  if v_campaign_id is null then
    raise exception 'Idempotent campaign lookup failed';
  end if;

  update public.campaign_generation_requests
  set status = 'succeeded',
      campaign_id = v_campaign_id,
      processing_token = null,
      processing_started_at = null,
      error_code = null
  where user_id = p_user_id and generation_key = p_generation_key;

  if not found then
    raise exception 'Generation key was not claimed before persistence' using errcode = '40001';
  end if;

  return v_campaign_id;
end;
$$;

revoke all on function public.create_campaign_with_quests(uuid, uuid, text, integer, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_campaign_with_quests(uuid, uuid, text, integer, text, text, jsonb)
  to service_role;

drop function if exists public.complete_quest(uuid, numeric, text, text);

create function public.complete_quest(
  p_submission_id uuid,
  p_processing_token uuid,
  p_result jsonb,
  p_confidence numeric,
  p_reason text,
  p_model_used text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_submission public.quest_submissions%rowtype;
  v_quest public.quests%rowtype;
  v_campaign public.campaigns%rowtype;
  v_profile public.profiles%rowtype;
  v_old_level integer;
  v_new_level integer;
  v_new_xp integer;
  v_new_health integer;
  v_applied_damage integer;
  v_public_result jsonb;
  v_verified_at timestamptz := clock_timestamp();
begin
  if auth.role() <> 'service_role' then
    raise exception 'Server authorization required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_result) <> 'object' or p_confidence not between 0 and 1 then
    raise exception 'Invalid accepted verification result' using errcode = '22023';
  end if;

  select * into v_submission
  from public.quest_submissions
  where id = p_submission_id
  for update;
  if not found then
    raise exception 'Submission not found' using errcode = 'P0002';
  end if;

  select * into v_quest from public.quests
  where id = v_submission.quest_id and user_id = v_submission.user_id for update;
  if not found then
    raise exception 'Quest not found' using errcode = 'P0002';
  end if;
  select * into v_campaign from public.campaigns
  where id = v_submission.campaign_id and user_id = v_submission.user_id for update;
  if not found or v_campaign.id <> v_quest.campaign_id then
    raise exception 'Campaign not found' using errcode = 'P0002';
  end if;
  select * into v_profile from public.profiles
  where id = v_submission.user_id for update;
  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  if v_submission.verification_status = 'rejected' then
    raise exception 'Rejected verification is immutable' using errcode = '22023';
  end if;

  if v_submission.verification_status = 'accepted' then
    return coalesce(v_submission.verification_result, '{}'::jsonb)
      || jsonb_build_object('duplicate', true, 'xpAwarded', 0, 'enemyDamage', 0);
  end if;

  if v_submission.verification_status <> 'processing'
     or v_submission.processing_token <> p_processing_token then
    raise exception 'Verification lease is no longer active' using errcode = '40001';
  end if;
  if v_quest.status = 'locked' then
    raise exception 'Locked quests cannot be completed' using errcode = '22023';
  end if;

  if v_quest.status = 'completed' or v_submission.xp_awarded > 0 then
    v_public_result := p_result || jsonb_build_object(
      'submissionId', v_submission.id,
      'verifiedAt', v_verified_at,
      'verified', true,
      'duplicate', true,
      'xpAwarded', 0,
      'enemyDamage', 0,
      'totalXp', v_profile.total_xp,
      'currentLevel', v_profile.current_level,
      'enemyCurrentHealth', v_campaign.enemy_current_health,
      'levelledUp', false,
      'adaptiveQuestCreated', false
    );
  else
    v_old_level := v_profile.current_level;
    v_new_xp := v_profile.total_xp + v_quest.xp_reward;
    v_new_level := floor(v_new_xp / 100.0)::integer + 1;
    v_applied_damage := least(v_quest.enemy_damage, v_campaign.enemy_current_health);
    v_new_health := greatest(0, v_campaign.enemy_current_health - v_applied_damage);

    update public.quests set status = 'completed', completed_at = now()
    where id = v_quest.id;
    update public.profiles set total_xp = v_new_xp, current_level = v_new_level
    where id = v_submission.user_id;
    update public.campaigns
    set enemy_current_health = v_new_health,
        status = case when v_new_health = 0 then 'won' else status end
    where id = v_campaign.id;

    insert into public.progress_events (
      user_id, campaign_id, quest_id, event_type, xp_change,
      enemy_health_change, metadata
    ) values (
      v_submission.user_id, v_campaign.id, v_quest.id, 'quest_completed',
      v_quest.xp_reward, -v_applied_damage,
      jsonb_build_object('submissionId', p_submission_id)
    ) on conflict do nothing;

    if v_new_level > v_old_level then
      insert into public.progress_events (
        user_id, campaign_id, quest_id, event_type, metadata
      ) values (
        v_submission.user_id, v_campaign.id, v_quest.id, 'level_up',
        jsonb_build_object('level', v_new_level)
      );
    end if;

    if v_new_health = 0 and v_campaign.enemy_current_health > 0 then
      insert into public.progress_events (
        user_id, campaign_id, quest_id, event_type, metadata
      ) values (
        v_submission.user_id, v_campaign.id, v_quest.id, 'campaign_won',
        jsonb_build_object('enemy', v_campaign.enemy_name)
      );
    end if;

    update public.quests
    set status = 'available'
    where id = (
      select id from public.quests
      where campaign_id = v_campaign.id
        and status = 'locked'
        and is_adaptive = false
      order by sequence_number
      limit 1
    );

    v_public_result := p_result || jsonb_build_object(
      'submissionId', v_submission.id,
      'verifiedAt', v_verified_at,
      'verified', true,
      'duplicate', false,
      'xpAwarded', v_quest.xp_reward,
      'enemyDamage', v_applied_damage,
      'totalXp', v_new_xp,
      'currentLevel', v_new_level,
      'enemyCurrentHealth', v_new_health,
      'levelledUp', v_new_level > v_old_level,
      'adaptiveQuestCreated', false
    );
  end if;

  update public.quest_submissions
  set verification_status = 'accepted',
      verification_result = v_public_result,
      verification_confidence = p_confidence,
      verification_reason = left(p_reason, 500),
      model_used = p_model_used,
      xp_awarded = case when (v_public_result ->> 'duplicate')::boolean then 0 else v_quest.xp_reward end,
      enemy_damage_awarded = coalesce((v_public_result ->> 'enemyDamage')::integer, 0),
      verified_at = v_verified_at,
      processing_token = null,
      processing_started_at = null,
      last_error_code = null
  where id = p_submission_id;

  return v_public_result;
end;
$$;

revoke all on function public.complete_quest(uuid, uuid, jsonb, numeric, text, text)
  from public, anon, authenticated;
grant execute on function public.complete_quest(uuid, uuid, jsonb, numeric, text, text)
  to service_role;

-- Correct lifetime aggregates independent of the campaign history page size.
alter table public.campaigns
  drop constraint if exists campaigns_status_check;
alter table public.campaigns
  add constraint campaigns_status_check
    check (status in ('active', 'paused', 'won', 'archived', 'abandoned'));

create or replace function public.get_my_profile_aggregates()
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with completion_days as (
    select distinct timezone('UTC', created_at)::date as completed_day
    from public.progress_events
    where user_id = auth.uid() and event_type = 'quest_completed'
  ),
  grouped_days as (
    select completed_day,
      completed_day - (row_number() over (order by completed_day))::integer as streak_group
    from completion_days
  ),
  streaks as (
    select min(completed_day) as first_day, max(completed_day) as last_day,
      count(*)::integer as length
    from grouped_days
    group by streak_group
  )
  select jsonb_build_object(
    'totalCampaigns', (select count(*) from public.campaigns where user_id = auth.uid()),
    'activeCampaigns', (select count(*) from public.campaigns where user_id = auth.uid() and status = 'active'),
    'pausedCampaigns', (select count(*) from public.campaigns where user_id = auth.uid() and status = 'paused'),
    'wonCampaigns', (select count(*) from public.campaigns where user_id = auth.uid() and status = 'won'),
    'archivedCampaigns', (select count(*) from public.campaigns where user_id = auth.uid() and status in ('archived', 'abandoned')),
    'totalQuestsCompleted', (select count(*) from public.quests where user_id = auth.uid() and status = 'completed'),
    'totalXp', coalesce((select total_xp from public.profiles where id = auth.uid()), 0),
    'totalEnemyDamage', coalesce((
      select sum(greatest(0, -enemy_health_change))
      from public.progress_events
      where user_id = auth.uid() and event_type = 'quest_completed'
    ), 0),
    'currentLevel', coalesce((select current_level from public.profiles where id = auth.uid()), 1),
    'currentStreak', coalesce((
      select length from streaks
      where last_day = (select max(completed_day) from completion_days)
        and last_day >= timezone('UTC', now())::date - 1
    ), 0),
    'longestStreak', coalesce((select max(length) from streaks), 0)
  );
$$;

revoke all on function public.get_my_profile_aggregates() from public, anon;
grant execute on function public.get_my_profile_aggregates() to authenticated;

-- Privacy-safe, user-scoped AI usage ledger and server-side monthly totals.
create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  operation text not null check (
    operation in ('campaign_generation', 'proof_moderation', 'proof_verification', 'adaptive_generation', 'realtime_narration')
  ),
  model text not null check (char_length(model) between 1 and 120),
  input_units integer check (input_units is null or input_units >= 0),
  output_units integer check (output_units is null or output_units >= 0),
  latency_ms integer not null check (latency_ms >= 0),
  success boolean not null,
  estimated_cost_microusd bigint check (
    estimated_cost_microusd is null or estimated_cost_microusd >= 0
  ),
  trace_id uuid not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_events_user_month_idx
  on public.ai_usage_events(user_id, created_at desc);
create index if not exists ai_usage_events_user_operation_idx
  on public.ai_usage_events(user_id, operation, created_at desc);

alter table public.ai_usage_events enable row level security;
create policy "ai_usage_select_own" on public.ai_usage_events for select
using (auth.uid() = user_id);

revoke all on public.ai_usage_events from public, anon, authenticated;
grant select on public.ai_usage_events to authenticated;
grant select, insert on public.ai_usage_events to service_role;

create or replace function public.get_ai_usage_monthly_for_user(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Server authorization required' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'campaignGeneration', count(*) filter (where operation = 'campaign_generation'),
      'proofModeration', count(*) filter (where operation = 'proof_moderation'),
      'proofVerification', count(*) filter (where operation = 'proof_verification'),
      'adaptiveGeneration', count(*) filter (where operation = 'adaptive_generation'),
      'realtimeNarration', count(*) filter (where operation = 'realtime_narration'),
      'inputUnits', coalesce(sum(input_units), 0),
      'outputUnits', coalesce(sum(output_units), 0),
      'estimatedCostMicrousd', coalesce(sum(estimated_cost_microusd), 0)
    )
    from public.ai_usage_events
    where user_id = p_user_id
      and created_at >= date_trunc('month', timezone('UTC', now()))
  );
end;
$$;

revoke all on function public.get_ai_usage_monthly_for_user(uuid)
  from public, anon, authenticated;
grant execute on function public.get_ai_usage_monthly_for_user(uuid)
  to service_role;

commit;
