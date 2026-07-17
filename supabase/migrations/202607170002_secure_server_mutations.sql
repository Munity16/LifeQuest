begin;

alter table public.campaigns
  add column if not exists generation_key uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'campaigns_user_generation_key_key'
      and conrelid = 'public.campaigns'::regclass
  ) then
    alter table public.campaigns
      add constraint campaigns_user_generation_key_key unique (user_id, generation_key);
  end if;
end;
$$;

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
begin
  if auth.role() <> 'service_role' then
    raise exception 'Server authorization required' using errcode = '42501';
  end if;

  if p_user_id is null or p_generation_key is null then
    raise exception 'User and generation key are required' using errcode = '22023';
  end if;

  if jsonb_typeof(p_generated) <> 'object'
     or jsonb_typeof(p_generated -> 'quests') <> 'array'
     or jsonb_array_length(p_generated -> 'quests') < 3
     or jsonb_array_length(p_generated -> 'quests') > 7 then
    raise exception 'Generated campaign payload is invalid' using errcode = '22023';
  end if;

  insert into public.campaigns (
    user_id,
    generation_key,
    goal,
    daily_minutes,
    main_obstacle,
    difficulty,
    campaign_name,
    hero_name,
    enemy_name,
    enemy_description,
    story
  ) values (
    p_user_id,
    p_generation_key,
    p_goal,
    p_daily_minutes,
    p_main_obstacle,
    p_difficulty,
    p_generated ->> 'campaignName',
    p_generated ->> 'heroName',
    p_generated ->> 'enemyName',
    p_generated ->> 'enemyDescription',
    p_generated ->> 'story'
  )
  on conflict (user_id, generation_key) do nothing
  returning id into v_campaign_id;

  if v_campaign_id is null then
    select id into v_campaign_id
    from public.campaigns
    where user_id = p_user_id and generation_key = p_generation_key;

    if v_campaign_id is null then
      raise exception 'Idempotent campaign lookup failed';
    end if;

    return v_campaign_id;
  end if;

  for v_quest, v_ordinality in
    select value, ordinality
    from jsonb_array_elements(p_generated -> 'quests') with ordinality
  loop
    insert into public.quests (
      campaign_id,
      user_id,
      day_number,
      sequence_number,
      title,
      story_intro,
      description,
      difficulty,
      estimated_minutes,
      xp_reward,
      enemy_damage,
      proof_type,
      success_requirements,
      status
    ) values (
      v_campaign_id,
      p_user_id,
      (v_quest ->> 'dayNumber')::integer,
      (v_quest ->> 'sequenceNumber')::integer,
      v_quest ->> 'title',
      v_quest ->> 'storyIntro',
      v_quest ->> 'description',
      v_quest ->> 'difficulty',
      (v_quest ->> 'estimatedMinutes')::integer,
      (v_quest ->> 'xpReward')::integer,
      (v_quest ->> 'enemyDamage')::integer,
      coalesce(v_quest ->> 'proofType', 'image'),
      v_quest -> 'successRequirements',
      case when v_ordinality <= 3 then 'available' else 'locked' end
    );
  end loop;

  return v_campaign_id;
end;
$$;

revoke all on function public.create_campaign_with_quests(uuid, uuid, text, integer, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_campaign_with_quests(uuid, uuid, text, integer, text, text, jsonb) to service_role;

create or replace function public.complete_quest(
  p_submission_id uuid,
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
  v_user_id uuid;
  v_old_level integer;
  v_new_level integer;
  v_new_xp integer;
  v_new_health integer;
  v_applied_damage integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Server authorization required' using errcode = '42501';
  end if;

  select * into v_submission
  from public.quest_submissions
  where id = p_submission_id
  for update;

  if not found then
    raise exception 'Submission not found' using errcode = 'P0002';
  end if;

  v_user_id := v_submission.user_id;

  select * into v_quest
  from public.quests
  where id = v_submission.quest_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Quest not found' using errcode = 'P0002';
  end if;

  select * into v_campaign
  from public.campaigns
  where id = v_submission.campaign_id and user_id = v_user_id
  for update;

  if not found or v_campaign.id <> v_quest.campaign_id then
    raise exception 'Campaign not found' using errcode = 'P0002';
  end if;

  select * into v_profile
  from public.profiles
  where id = v_user_id
  for update;

  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  if v_quest.status = 'locked' then
    raise exception 'Locked quests cannot be completed' using errcode = '22023';
  end if;

  if v_quest.status = 'completed' or v_submission.xp_awarded > 0 then
    if v_submission.verification_status <> 'accepted' then
      update public.quest_submissions
      set verification_status = 'accepted',
          verification_confidence = p_confidence,
          verification_reason = left(p_reason, 500),
          model_used = p_model_used,
          verified_at = now()
      where id = p_submission_id;
    end if;

    return jsonb_build_object(
      'duplicate', true,
      'xpAwarded', 0,
      'enemyDamage', 0,
      'totalXp', v_profile.total_xp,
      'currentLevel', v_profile.current_level,
      'enemyCurrentHealth', v_campaign.enemy_current_health,
      'levelledUp', false
    );
  end if;

  v_old_level := v_profile.current_level;
  v_new_xp := v_profile.total_xp + v_quest.xp_reward;
  v_new_level := floor(v_new_xp / 100.0)::integer + 1;
  v_applied_damage := least(v_quest.enemy_damage, v_campaign.enemy_current_health);
  v_new_health := greatest(0, v_campaign.enemy_current_health - v_applied_damage);

  update public.quest_submissions
  set verification_status = 'accepted',
      verification_confidence = p_confidence,
      verification_reason = left(p_reason, 500),
      model_used = p_model_used,
      xp_awarded = v_quest.xp_reward,
      enemy_damage_awarded = v_applied_damage,
      verified_at = now()
  where id = p_submission_id;

  update public.quests
  set status = 'completed', completed_at = now()
  where id = v_quest.id;

  update public.profiles
  set total_xp = v_new_xp, current_level = v_new_level
  where id = v_user_id;

  update public.campaigns
  set enemy_current_health = v_new_health,
      status = case when v_new_health = 0 then 'won' else status end
  where id = v_campaign.id;

  insert into public.progress_events (
    user_id, campaign_id, quest_id, event_type, xp_change, enemy_health_change, metadata
  ) values (
    v_user_id,
    v_campaign.id,
    v_quest.id,
    'quest_completed',
    v_quest.xp_reward,
    -v_applied_damage,
    jsonb_build_object('submissionId', p_submission_id)
  );

  if v_new_level > v_old_level then
    insert into public.progress_events (user_id, campaign_id, quest_id, event_type, metadata)
    values (v_user_id, v_campaign.id, v_quest.id, 'level_up', jsonb_build_object('level', v_new_level));
  end if;

  if v_new_health = 0 and v_campaign.enemy_current_health > 0 then
    insert into public.progress_events (user_id, campaign_id, quest_id, event_type, metadata)
    values (v_user_id, v_campaign.id, v_quest.id, 'campaign_won', jsonb_build_object('enemy', v_campaign.enemy_name));
  end if;

  update public.quests
  set status = 'available'
  where id = (
    select id
    from public.quests
    where campaign_id = v_campaign.id and status = 'locked' and is_adaptive = false
    order by sequence_number
    limit 1
  );

  return jsonb_build_object(
    'duplicate', false,
    'xpAwarded', v_quest.xp_reward,
    'enemyDamage', v_applied_damage,
    'totalXp', v_new_xp,
    'currentLevel', v_new_level,
    'enemyCurrentHealth', v_new_health,
    'levelledUp', v_new_level > v_old_level
  );
end;
$$;

revoke all on function public.complete_quest(uuid, numeric, text, text) from public, anon, authenticated;
grant execute on function public.complete_quest(uuid, numeric, text, text) to service_role;

commit;
