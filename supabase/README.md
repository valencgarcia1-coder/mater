# Supabase setup

The database for properties, cameras, spaces, live status, event history,
users/roles, alerts and notification preferences. Schema is in
`migrations/`; nothing here can dispatch a tow — alerts are for a human to
review (acknowledge / dismiss).

## One-time setup

1. Create a project at supabase.com.
2. Apply the schema: paste `migrations/*.sql` into the SQL editor, or
   `supabase link` then `supabase db push`.
3. In Project Settings → API copy the **URL** and the **service_role** key.
   Export them in the shell that runs the detector (never commit them, never
   put the service_role key in the dashboard):
   ```
   export SUPABASE_URL=https://<ref>.supabase.co
   export SUPABASE_SERVICE_ROLE_KEY=<service_role key>
   ```
4. Sync the property, camera and spaces (safe to re-run):
   ```
   cd detector
   .venv/bin/python -m detector.supabase_seed --property "Ski Lot" --camera "Main lot"
   ```
   It prints `SUPABASE_CAMERA_ID=...`; export that too.
5. Sign up a user (Auth → Users), then make them the property's admin in the
   SQL editor:
   ```sql
   insert into property_members (property_id, user_id, role)
   select id, '<user uuid>', 'admin' from properties where name = 'Ski Lot';
   ```
6. Run the detector with events going to Supabase as well as `events.jsonl`:
   ```
   .venv/bin/python -m detector.server <source> --supabase ...
   ```

## Tests

- SQL + row-level security, on real Postgres: `cd supabase/tests && npm install && npm test`
- Event sink + seed script: `cd detector && .venv/bin/python -m unittest discover -s tests -t .`
