begin;

alter table public.quest_submissions
  alter column storage_path drop not null,
  add column if not exists proof_deleted_at timestamptz;

create index if not exists submissions_active_proofs_idx
  on public.quest_submissions(created_at)
  where storage_path is not null and proof_deleted_at is null;

create table if not exists public.api_rate_limits (
  identifier_hash text not null check (char_length(identifier_hash) = 64),
  action text not null check (char_length(action) between 3 and 80),
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1 check (request_count > 0),
  expires_at timestamptz not null,
  primary key (identifier_hash, action)
);

create index if not exists api_rate_limits_expiry_idx
  on public.api_rate_limits(expires_at);

create table if not exists public.operational_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null check (char_length(event_name) between 3 and 80),
  trace_id uuid not null,
  status text not null check (status in ('success', 'rejected', 'error', 'rate_limited')),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  error_code text check (error_code is null or char_length(error_code) <= 80),
  model text check (model is null or char_length(model) <= 120),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists operational_events_created_at_idx
  on public.operational_events(created_at desc);
create index if not exists operational_events_name_status_idx
  on public.operational_events(event_name, status, created_at desc);

alter table public.api_rate_limits enable row level security;
alter table public.operational_events enable row level security;

revoke all on public.api_rate_limits, public.operational_events from public, anon, authenticated;
grant select, insert, update, delete on public.api_rate_limits to service_role;
grant select, insert, delete on public.operational_events to service_role;

create or replace function public.consume_api_rate_limit(
  p_identifier_hash text,
  p_action text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
  v_expires_at timestamptz;
  v_now timestamptz := clock_timestamp();
begin
  if auth.role() <> 'service_role' then
    raise exception 'Server authorization required' using errcode = '42501';
  end if;

  if p_identifier_hash !~ '^[0-9a-f]{64}$'
     or char_length(p_action) not between 3 and 80
     or p_limit not between 1 and 10000
     or p_window_seconds not between 1 and 86400 then
    raise exception 'Invalid rate-limit input' using errcode = '22023';
  end if;

  insert into public.api_rate_limits (
    identifier_hash,
    action,
    window_started_at,
    request_count,
    expires_at
  ) values (
    p_identifier_hash,
    p_action,
    v_now,
    1,
    v_now + make_interval(secs => p_window_seconds)
  )
  on conflict (identifier_hash, action) do update
  set window_started_at = case
        when public.api_rate_limits.expires_at <= v_now then v_now
        else public.api_rate_limits.window_started_at
      end,
      request_count = case
        when public.api_rate_limits.expires_at <= v_now then 1
        else public.api_rate_limits.request_count + 1
      end,
      expires_at = case
        when public.api_rate_limits.expires_at <= v_now then v_now + make_interval(secs => p_window_seconds)
        else public.api_rate_limits.expires_at
      end
  returning request_count, expires_at into v_count, v_expires_at;

  return jsonb_build_object(
    'allowed', v_count <= p_limit,
    'remaining', greatest(0, p_limit - v_count),
    'retryAfterSeconds', greatest(1, ceil(extract(epoch from (v_expires_at - v_now)))::integer)
  );
end;
$$;

revoke all on function public.consume_api_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, text, integer, integer) to service_role;

commit;
