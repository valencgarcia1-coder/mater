-- Fires notify-alert (the SMS dispatch Edge Function) on every new alert.
--
-- The dashboard's "Database Webhooks" UI needs a supabase_functions schema
-- that isn't provisioned on every project (seen missing here) — this does
-- the same thing directly with pg_net (Database > Extensions > pg_net must
-- be enabled), no dependency on that UI.
--
-- The Authorization header uses the ANON key, not the service role key —
-- that's the public, client-safe key, fine to live in this file. It only
-- authenticates the *call into* the function; the function uses its own
-- service-role secret (set via `supabase secrets set`) for everything it
-- does once inside. Replace <ANON_KEY> with Project Settings -> API Keys ->
-- anon public before running this on a new project.

create or replace function public.notify_alert_webhook() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://uwgsharkxmdtcoxbhsbu.supabase.co/functions/v1/notify-alert',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <ANON_KEY>'
    ),
    body := jsonb_build_object('type', 'INSERT', 'table', 'alerts', 'record', to_jsonb(new))
  );
  return new;
end $$;

create trigger alerts_notify after insert on public.alerts
  for each row execute function public.notify_alert_webhook();
