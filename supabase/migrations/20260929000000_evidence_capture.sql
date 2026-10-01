-- Evidence capture: the detector snapshots the frame at the moment a space
-- crosses into violation/tow_eligible and uploads it to a private Storage
-- bucket, so a review decision — and eventually a tow dispatch — comes with
-- a photo instead of just a timestamp and a label.

alter table public.space_events add column evidence_path text;
alter table public.alerts add column evidence_path text;

-- One private bucket. Objects are keyed "<camera_id>/<label>/<state>-<ts>.jpg"
-- so a read policy can recover the camera (and therefore the property) from
-- the path alone, the same way every other table here scopes access.
insert into storage.buckets (id, name, public)
values ('evidence', 'evidence', false)
on conflict (id) do nothing;

create policy evidence_read on storage.objects for select to authenticated
  using (
    bucket_id = 'evidence'
    and public.has_property_role(
      public.camera_property(((storage.foldername(name))[1])::uuid),
      array['admin', 'reviewer', 'viewer']
    )
  );

-- The service role already bypasses RLS entirely; this just documents that
-- only the detector (never a browser client) is meant to write here.
create policy evidence_write on storage.objects for insert to service_role
  with check (bucket_id = 'evidence');

-- record_space_event gains an optional evidence_path so a snapshot taken at
-- the exact moment of a violation/tow_eligible transition rides along with
-- the event instead of being bolted on after the fact.
drop function public.record_space_event(uuid, text, text, numeric, timestamptz);

create function public.record_space_event(
  p_camera_id uuid, p_label text, p_state text, p_elapsed numeric, p_occurred_at timestamptz,
  p_evidence_path text default null
) returns bigint language plpgsql security definer set search_path = public as $$
declare v_space uuid; v_event bigint;
begin
  select id into v_space from public.spaces where camera_id = p_camera_id and label = p_label;
  if v_space is null then
    raise exception 'unknown space % on camera %', p_label, p_camera_id using errcode = 'P0002';
  end if;

  insert into public.space_events (space_id, state, elapsed_seconds, occurred_at, evidence_path)
  values (v_space, p_state, p_elapsed, p_occurred_at, p_evidence_path)
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
revoke all on function public.record_space_event(uuid, text, text, numeric, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.record_space_event(uuid, text, text, numeric, timestamptz, text)
  to service_role;

-- Carry the event's evidence photo onto the alert it raises.
create or replace function public.alerts_from_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_property uuid;
begin
  v_property := public.space_property(new.space_id);
  if new.state in ('violation', 'tow_eligible') then
    insert into public.alerts (property_id, space_id, event_id, kind, evidence_path)
    values (v_property, new.space_id, new.id, new.state, new.evidence_path)
    on conflict (space_id, kind) where status in ('open', 'acknowledged') do nothing;
  elsif new.state = 'empty' then
    update public.alerts set status = 'resolved'
    where space_id = new.space_id and status in ('open', 'acknowledged');
  end if;
  return new;
end $$;
