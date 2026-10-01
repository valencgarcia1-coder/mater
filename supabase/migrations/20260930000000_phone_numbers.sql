-- A phone number to text, per user, for dispatch notifications. Owner-only
-- write — the existing profiles_update policy (id = auth.uid()) already
-- covers this column, no new policy needed.

alter table public.profiles add column phone_number text;
