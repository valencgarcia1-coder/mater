-- Mater initial schema: properties, cameras, spaces, live status + event
-- history, users/roles, alerts, notification preferences.
--
-- Access model: a user only ever sees properties they're a member of
-- (admin > reviewer > viewer). The detector writes with the service-role key
-- through record_space_event() and never with a user's credentials. Alerts
-- are reviewed by a human (acknowledge/dismiss); nothing here dispatches a
-- tow on its own.

-- ---------------------------------------------------------------- tables

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  timezone text not null default 'America/Denver',
  created_at timestamptz not null default now()
);

-- No source-URL column on purpose: RTSP URLs commonly embed credentials.
create table public.cameras (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (property_id, name)
);

create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  camera_id uuid not null references public.cameras(id) on delete cascade,
  label text not null,
  zone text not null default 'standard'
    check (zone in ('standard', 'fire_lane', 'handicap', 'loading_zone')),
  polygon jsonb not null
    check (jsonb_typeof(polygon) = 'array' and jsonb_array_length(polygon) >= 3),
  created_at timestamptz not null default now(),
  unique (camera_id, label)
);

-- One row per space: what the dashboard shows right now.
create table public.space_status (
  space_id uuid primary key references public.spaces(id) on delete cascade,
  state text not null
    check (state in ('empty', 'arriving', 'parked', 'violation', 'tow_eligible')),
  parked_since timestamptz,  -- when the parked clock started; null while empty/arriving
  updated_at timestamptz not null default now()
);

-- Append-only history of state transitions (what events.jsonl holds today).
create table public.space_events (
  id bigint generated always as identity primary key,
  space_id uuid not null references public.spaces(id) on delete cascade,
  state text not null
    check (state in ('empty', 'arriving', 'parked', 'violation', 'tow_eligible')),
  elapsed_seconds numeric check (elapsed_seconds is null or elapsed_seconds >= 0),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index space_events_space_time_idx on public.space_events (space_id, occurred_at desc);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

create table public.property_members (
  property_id uuid not null references public.properties(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'reviewer', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (property_id, user_id)
);
create index property_members_user_idx on public.property_members (user_id);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  space_id uuid not null references public.spaces(id) on delete cascade,
  event_id bigint references public.space_events(id) on delete set null,
  kind text not null check (kind in ('violation', 'tow_eligible')),
  status text not null default 'open'
    check (status in ('open', 'acknowledged', 'dismissed', 'resolved')),
  created_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  note text
);
create index alerts_property_status_idx on public.alerts (property_id, status, created_at desc);
-- One live alert per space per kind; a dismissed/resolved one doesn't block a new one.
create unique index alerts_one_live_per_space_kind
  on public.alerts (space_id, kind) where status in ('open', 'acknowledged');

create table public.notification_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  channel text not null check (channel in ('email', 'sms', 'push')),
  kinds text[] not null default '{violation,tow_eligible}',
  enabled boolean not null default true,
  primary key (user_id, property_id, channel)
);

-- --------------------------------------------------------- access helpers
-- security definer so policies can consult membership without recursing into
-- property_members' own policies.

create function public.property_role(p_property_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select role from public.property_members
  where property_id = p_property_id and user_id = auth.uid()
$$;

create function public.has_property_role(p_property_id uuid, p_roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.property_role(p_property_id) = any (p_roles), false)
$$;

create function public.space_property(p_space_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select c.property_id from public.spaces s join public.cameras c on c.id = s.camera_id
  where s.id = p_space_id
$$;

create function public.camera_property(p_camera_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select property_id from public.cameras where id = p_camera_id
$$;

-- ------------------------------------------------------------ automation

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- A violation / tow_eligible transition raises an alert for a human to review;
-- the space going empty resolves whatever is still live.
create function public.alerts_from_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_property uuid;
begin
  v_property := public.space_property(new.space_id);
  if new.state in ('violation', 'tow_eligible') then
    insert into public.alerts (property_id, space_id, event_id, kind)
    values (v_property, new.space_id, new.id, new.state)
    on conflict (space_id, kind) where status in ('open', 'acknowledged') do nothing;
  elsif new.state = 'empty' then
    update public.alerts set status = 'resolved'
    where space_id = new.space_id and status in ('open', 'acknowledged');
  end if;
  return new;
end $$;
create trigger space_events_raise_alerts after insert on public.space_events
  for each row execute function public.alerts_from_event();

-- ---------------------------------------------------------- RPC functions

-- The detector's single write path (service role only): resolves the space by
-- (camera, label), appends the event, and updates the live status.
create function public.record_space_event(
  p_camera_id uuid, p_label text, p_state text, p_elapsed numeric, p_occurred_at timestamptz
) returns bigint language plpgsql security definer set search_path = public as $$
declare v_space uuid; v_event bigint;
begin
  select id into v_space from public.spaces where camera_id = p_camera_id and label = p_label;
  if v_space is null then
    raise exception 'unknown space % on camera %', p_label, p_camera_id using errcode = 'P0002';
  end if;

  insert into public.space_events (space_id, state, elapsed_seconds, occurred_at)
  values (v_space, p_state, p_elapsed, p_occurred_at)
  returning id into v_event;

  insert into public.space_status (space_id, state, parked_since, updated_at)
  values (
    v_space, p_state,
    case when p_elapsed is null then null else p_occurred_at - make_interval(secs => p_elapsed) end,
    now()
  )
  on conflict (space_id) do update
    set state = excluded.state, parked_since = excluded.parked_since, updated_at = excluded.updated_at;

  return v_event;
end $$;
revoke all on function public.record_space_event(uuid, text, text, numeric, timestamptz)
  from public, anon, authenticated;
grant execute on function public.record_space_event(uuid, text, text, numeric, timestamptz)
  to service_role;

-- Creating a property and becoming its admin has to be one atomic step.
create function public.create_property(p_name text, p_address text default null,
                                       p_timezone text default 'America/Denver')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '28000'; end if;
  insert into public.properties (name, address, timezone) values (p_name, p_address, p_timezone)
  returning id into v_id;
  insert into public.property_members (property_id, user_id, role) values (v_id, auth.uid(), 'admin');
  return v_id;
end $$;
revoke all on function public.create_property(text, text, text) from public, anon;
grant execute on function public.create_property(text, text, text) to authenticated;

-- Alerts can't be updated directly (RLS can't limit which columns change);
-- reviewing goes through here so only status/notes/reviewer are touched.
create function public.review_alert(p_alert_id uuid, p_status text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_property uuid;
begin
  if p_status not in ('acknowledged', 'dismissed') then
    raise exception 'status must be acknowledged or dismissed' using errcode = '22023';
  end if;
  select property_id into v_property from public.alerts where id = p_alert_id;
  if v_property is null or not public.has_property_role(v_property, array['admin', 'reviewer']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.alerts
  set status = p_status, note = p_note, reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_alert_id and status in ('open', 'acknowledged');
end $$;
revoke all on function public.review_alert(uuid, text, text) from public, anon;
grant execute on function public.review_alert(uuid, text, text) to authenticated;

-- -------------------------------------------------- row level security

alter table public.properties enable row level security;
alter table public.cameras enable row level security;
alter table public.spaces enable row level security;
alter table public.space_status enable row level security;
alter table public.space_events enable row level security;
alter table public.profiles enable row level security;
alter table public.property_members enable row level security;
alter table public.alerts enable row level security;
alter table public.notification_preferences enable row level security;

create policy properties_select on public.properties for select to authenticated
  using (public.has_property_role(id, array['admin', 'reviewer', 'viewer']));
create policy properties_update on public.properties for update to authenticated
  using (public.has_property_role(id, array['admin']))
  with check (public.has_property_role(id, array['admin']));

create policy cameras_select on public.cameras for select to authenticated
  using (public.has_property_role(property_id, array['admin', 'reviewer', 'viewer']));
create policy cameras_write on public.cameras for all to authenticated
  using (public.has_property_role(property_id, array['admin']))
  with check (public.has_property_role(property_id, array['admin']));

create policy spaces_select on public.spaces for select to authenticated
  using (public.has_property_role(public.camera_property(camera_id), array['admin', 'reviewer', 'viewer']));
create policy spaces_write on public.spaces for all to authenticated
  using (public.has_property_role(public.camera_property(camera_id), array['admin']))
  with check (public.has_property_role(public.camera_property(camera_id), array['admin']));

create policy space_status_select on public.space_status for select to authenticated
  using (public.has_property_role(public.space_property(space_id), array['admin', 'reviewer', 'viewer']));
create policy space_events_select on public.space_events for select to authenticated
  using (public.has_property_role(public.space_property(space_id), array['admin', 'reviewer', 'viewer']));

create policy alerts_select on public.alerts for select to authenticated
  using (public.has_property_role(property_id, array['admin', 'reviewer', 'viewer']));

create policy profiles_select on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from public.property_members mine
      join public.property_members theirs on theirs.property_id = mine.property_id
      where mine.user_id = auth.uid() and theirs.user_id = profiles.id
    )
  );
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy members_select on public.property_members for select to authenticated
  using (user_id = auth.uid() or public.has_property_role(property_id, array['admin', 'reviewer', 'viewer']));
create policy members_write on public.property_members for all to authenticated
  using (public.has_property_role(property_id, array['admin']))
  with check (public.has_property_role(property_id, array['admin']));

create policy prefs_own on public.notification_preferences for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and public.has_property_role(property_id, array['admin', 'reviewer', 'viewer'])
  );

-- Live dashboard updates (the publication exists on Supabase; skipped elsewhere).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.space_status, public.alerts;
  end if;
end $$;
