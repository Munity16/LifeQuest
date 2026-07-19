begin;

alter table public.profiles
  add column if not exists appearance_preferences jsonb not null default '{}'::jsonb
  check (jsonb_typeof(appearance_preferences) = 'object');

grant update (appearance_preferences) on public.profiles to authenticated;

commit;
