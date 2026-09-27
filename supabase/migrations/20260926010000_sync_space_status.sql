-- Snapshot sync: the detector pushes every space's current state periodically.
-- record_space_event only fires on a state *change*, so without this the live
-- status table stays empty until something happens, and any event dropped
-- during a network outage would leave it wrong indefinitely. This updates
-- space_status (and keeps alerts consistent with it) without inventing history
-- rows in space_events.

create function public.sync_space_status(p_camera_id uuid, p_states jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v record;
  v_space uuid;
  v_property uuid := public.camera_property(p_camera_id);
  v_parked timestamptz;
  v_existing timestamptz;
  n integer := 0;
begin
  if v_property is null then
    raise exception 'unknown camera %', p_camera_id using errcode = 'P0002';
  end if;

  for v in
    select e ->> 'label' as label, e ->> 'state' as state, nullif(e ->> 'elapsed', '')::numeric as elapsed
    from jsonb_array_elements(p_states) e
  loop
    select id into v_space from public.spaces where camera_id = p_camera_id and label = v.label;
    continue when v_space is null;  -- a label that was never seeded shouldn't fail the whole batch

    v_parked := case when v.elapsed is null then null else now() - make_interval(secs => v.elapsed) end;
    -- The clock start is recomputed from "elapsed" on every sync, so keep the
    -- stored value unless it moved by more than jitter; otherwise the row
    -- would change (and notify realtime subscribers) every single sync.
    select parked_since into v_existing from public.space_status where space_id = v_space;
    if v_existing is not null and v_parked is not null
       and abs(extract(epoch from v_existing - v_parked)) < 10 then
      v_parked := v_existing;
    end if;

    insert into public.space_status (space_id, state, parked_since, updated_at)
    values (v_space, v.state, v_parked, now())
    on conflict (space_id) do update
      set state = excluded.state, parked_since = excluded.parked_since, updated_at = excluded.updated_at
      where public.space_status.state is distinct from excluded.state
         or public.space_status.parked_since is distinct from excluded.parked_since;

    if v.state in ('violation', 'tow_eligible') then
      insert into public.alerts (property_id, space_id, kind)
      values (v_property, v_space, v.state)
      on conflict (space_id, kind) where status in ('open', 'acknowledged') do nothing;
    elsif v.state = 'empty' then
      update public.alerts set status = 'resolved'
      where space_id = v_space and status in ('open', 'acknowledged');
    end if;

    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.sync_space_status(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.sync_space_status(uuid, jsonb) to service_role;
