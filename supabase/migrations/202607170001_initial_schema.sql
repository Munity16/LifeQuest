begin;

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  total_xp integer not null default 0 check (total_xp >= 0),
  current_level integer not null default 1 check (current_level >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  goal text not null check (char_length(goal) between 10 and 240),
  daily_minutes integer not null check (daily_minutes in (15, 30, 45, 60)),
  main_obstacle text not null check (char_length(main_obstacle) between 2 and 100),
  difficulty text not null check (difficulty in ('gentle', 'balanced', 'challenging')),
  campaign_name text not null check (char_length(campaign_name) between 3 and 100),
  hero_name text not null check (char_length(hero_name) between 2 and 80),
  enemy_name text not null check (char_length(enemy_name) between 2 and 80),
  enemy_description text check (enemy_description is null or char_length(enemy_description) between 10 and 300),
  story text not null check (char_length(story) between 30 and 1000),
  enemy_max_health integer not null default 100 check (enemy_max_health > 0),
  enemy_current_health integer not null default 100 check (enemy_current_health >= 0 and enemy_current_health <= enemy_max_health),
  status text not null default 'active' check (status in ('active', 'won', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quests (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  day_number integer not null check (day_number between 1 and 7),
  sequence_number integer not null check (sequence_number > 0),
  title text not null check (char_length(title) between 3 and 100),
  story_intro text check (story_intro is null or char_length(story_intro) between 10 and 300),
  description text not null check (char_length(description) between 10 and 600),
  difficulty text not null check (difficulty in ('gentle', 'balanced', 'challenging')),
  estimated_minutes integer not null check (estimated_minutes between 5 and 120),
  xp_reward integer not null check (xp_reward between 10 and 100),
  enemy_damage integer not null check (enemy_damage between 5 and 40),
  proof_type text not null default 'image' check (proof_type = 'image'),
  success_requirements jsonb not null check (jsonb_typeof(success_requirements) = 'array'),
  status text not null default 'available' check (status in ('locked', 'available', 'in_progress', 'completed')),
  is_adaptive boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, sequence_number)
);

create table if not exists public.quest_submissions (
  id uuid primary key default gen_random_uuid(),
  quest_id uuid not null references public.quests(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  verification_status text not null default 'pending' check (verification_status in ('pending', 'accepted', 'rejected', 'error')),
  verification_confidence numeric check (verification_confidence is null or verification_confidence between 0 and 1),
  verification_reason text check (verification_reason is null or char_length(verification_reason) <= 500),
  model_used text,
  xp_awarded integer not null default 0 check (xp_awarded >= 0),
  enemy_damage_awarded integer not null default 0 check (enemy_damage_awarded >= 0),
  created_at timestamptz not null default now(),
  verified_at timestamptz
);

create table if not exists public.progress_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  quest_id uuid references public.quests(id) on delete cascade,
  event_type text not null check (event_type in ('quest_completed', 'level_up', 'campaign_won')),
  xp_change integer not null default 0,
  enemy_health_change integer not null default 0,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists campaigns_user_id_idx on public.campaigns(user_id);
create index if not exists campaigns_user_status_idx on public.campaigns(user_id, status);
create index if not exists quests_campaign_id_idx on public.quests(campaign_id, sequence_number);
create index if not exists quests_user_status_idx on public.quests(user_id, status);
create index if not exists submissions_quest_id_idx on public.quest_submissions(quest_id, created_at desc);
create index if not exists submissions_user_id_idx on public.quest_submissions(user_id, created_at desc);
create index if not exists progress_events_user_id_idx on public.progress_events(user_id, created_at desc);
create unique index if not exists one_completion_event_per_quest_idx
  on public.progress_events(quest_id, event_type)
  where event_type = 'quest_completed';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists campaigns_set_updated_at on public.campaigns;
create trigger campaigns_set_updated_at before update on public.campaigns
for each row execute function public.set_updated_at();

drop trigger if exists quests_set_updated_at on public.quests;
create trigger quests_set_updated_at before update on public.quests
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.campaigns enable row level security;
alter table public.quests enable row level security;
alter table public.quest_submissions enable row level security;
alter table public.progress_events enable row level security;

create policy "profiles_select_own" on public.profiles for select
using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update
using (auth.uid() = id) with check (auth.uid() = id);

create policy "campaigns_select_own" on public.campaigns for select
using (auth.uid() = user_id);
create policy "quests_select_own" on public.quests for select
using (auth.uid() = user_id);
create policy "submissions_select_own" on public.quest_submissions for select
using (auth.uid() = user_id);
create policy "events_select_own" on public.progress_events for select
using (auth.uid() = user_id);

revoke all on public.profiles, public.campaigns, public.quests, public.quest_submissions, public.progress_events from anon, authenticated;
grant select on public.profiles, public.campaigns, public.quests, public.quest_submissions, public.progress_events to authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

create or replace function public.complete_quest(
  p_submission_id uuid,
  p_confidence numeric,
  p_reason text,
  p_model_used text
)
returns jsonb
language plpgsql
security definer
set search_path = public
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
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_submission from public.quest_submissions
  where id = p_submission_id for update;

  if not found or v_submission.user_id <> auth.uid() then
    raise exception 'Submission not found' using errcode = '42501';
  end if;

  select * into v_quest from public.quests
  where id = v_submission.quest_id and user_id = auth.uid() for update;
  select * into v_campaign from public.campaigns
  where id = v_submission.campaign_id and user_id = auth.uid() for update;
  select * into v_profile from public.profiles
  where id = auth.uid() for update;

  if v_quest.status = 'completed' or v_submission.xp_awarded > 0 then
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
  v_new_health := greatest(0, v_campaign.enemy_current_health - v_quest.enemy_damage);

  update public.quest_submissions
  set verification_status = 'accepted',
      verification_confidence = p_confidence,
      verification_reason = left(p_reason, 500),
      model_used = p_model_used,
      xp_awarded = v_quest.xp_reward,
      enemy_damage_awarded = v_quest.enemy_damage,
      verified_at = now()
  where id = p_submission_id;

  update public.quests
  set status = 'completed', completed_at = now()
  where id = v_quest.id;

  update public.profiles
  set total_xp = v_new_xp, current_level = v_new_level
  where id = auth.uid();

  update public.campaigns
  set enemy_current_health = v_new_health,
      status = case when v_new_health = 0 then 'won' else status end
  where id = v_campaign.id;

  insert into public.progress_events (
    user_id, campaign_id, quest_id, event_type, xp_change, enemy_health_change, metadata
  ) values (
    auth.uid(), v_campaign.id, v_quest.id, 'quest_completed', v_quest.xp_reward,
    -v_quest.enemy_damage, jsonb_build_object('submissionId', p_submission_id)
  );

  if v_new_level > v_old_level then
    insert into public.progress_events (user_id, campaign_id, quest_id, event_type, metadata)
    values (auth.uid(), v_campaign.id, v_quest.id, 'level_up', jsonb_build_object('level', v_new_level));
  end if;

  if v_new_health = 0 then
    insert into public.progress_events (user_id, campaign_id, quest_id, event_type, metadata)
    values (auth.uid(), v_campaign.id, v_quest.id, 'campaign_won', jsonb_build_object('enemy', v_campaign.enemy_name));
  end if;

  update public.quests
  set status = 'available'
  where id = (
    select id from public.quests
    where campaign_id = v_campaign.id and status = 'locked' and is_adaptive = false
    order by sequence_number
    limit 1
  );

  return jsonb_build_object(
    'duplicate', false,
    'xpAwarded', v_quest.xp_reward,
    'enemyDamage', v_quest.enemy_damage,
    'totalXp', v_new_xp,
    'currentLevel', v_new_level,
    'enemyCurrentHealth', v_new_health,
    'levelledUp', v_new_level > v_old_level
  );
end;
$$;

revoke all on function public.complete_quest(uuid, numeric, text, text) from public, anon;
grant execute on function public.complete_quest(uuid, numeric, text, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('quest-proofs', 'quest-proofs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "proofs_insert_own_folder" on storage.objects for insert to authenticated
with check (bucket_id = 'quest-proofs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "proofs_select_own_folder" on storage.objects for select to authenticated
using (bucket_id = 'quest-proofs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "proofs_delete_own_folder" on storage.objects for delete to authenticated
using (bucket_id = 'quest-proofs' and (storage.foldername(name))[1] = auth.uid()::text);

commit;
