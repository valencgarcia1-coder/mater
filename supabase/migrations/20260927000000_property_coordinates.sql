-- Coordinates for the Overview map (a pin per property). Nullable: a
-- property created before this migration, or one someone hasn't placed a pin
-- for yet, just doesn't render a pin rather than failing anything.
alter table public.properties
  add column lat double precision check (lat is null or lat between -90 and 90),
  add column lng double precision check (lng is null or lng between -180 and 180);
