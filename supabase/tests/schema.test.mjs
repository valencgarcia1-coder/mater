// Runs the migrations on real Postgres (PGlite) and checks the access model:
// tenant isolation, role limits, the alert lifecycle, and the detector write path.
// Supabase's auth schema and roles are stubbed just enough for this. Run: npm test
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";

const db = new PGlite();
let pass = 0, fail = 0;
const ok = (name, cond) => { cond ? pass++ : fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}`); };

// Supabase provides these; stub just enough for the migration to run.
await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  grant usage on schema public, auth to anon, authenticated, service_role;
`);
const migrationsDir = new URL("../migrations/", import.meta.url);
for (const f of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort())
  await db.exec(readFileSync(new URL(f, migrationsDir), "utf8"));
await db.exec(`grant all on all tables in schema public to authenticated, service_role;
               grant all on all sequences in schema public to authenticated, service_role;`);

const as = async (uid, role = "authenticated") => {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false); set role ${role};`);
};
const asAdmin = async () => { await db.exec(`reset role; select set_config('request.jwt.claim.sub','',false);`); };
const tryQ = async (sql, params) => { try { return { rows: (await db.query(sql, params)).rows }; } catch (e) { return { err: e.message }; } };

// users
await asAdmin();
const A = (await db.query(`insert into auth.users (raw_user_meta_data) values ('{"full_name":"Ann Admin"}') returning id`)).rows[0].id;
const R = (await db.query(`insert into auth.users default values returning id`)).rows[0].id;
const V = (await db.query(`insert into auth.users default values returning id`)).rows[0].id;
const X = (await db.query(`insert into auth.users default values returning id`)).rows[0].id;
ok("profile auto-created on signup", (await db.query(`select full_name from profiles where id=$1`, [A])).rows[0]?.full_name === "Ann Admin");

// admin creates property + camera + space
await as(A);
const P = (await db.query(`select create_property('Ski Lot','1 Main St') as id`)).rows[0].id;
ok("create_property makes caller an admin", (await db.query(`select property_role($1) r`, [P])).rows[0].r === "admin");
const C = (await db.query(`insert into cameras (property_id,name) values ($1,'North') returning id`, [P])).rows[0].id;
const poly = JSON.stringify([[0,0],[10,0],[10,10],[0,10]]);
const S = (await db.query(`insert into spaces (camera_id,label,polygon) values ($1,'7',$2::jsonb) returning id`, [C, poly])).rows[0].id;
ok("admin can add camera + space", !!S);
ok("bad polygon (<3 pts) rejected by the database", !!(await tryQ(`insert into spaces (camera_id,label,polygon) values ($1,'8','[[0,0]]'::jsonb)`, [C])).err);
ok("duplicate label on a camera rejected", !!(await tryQ(`insert into spaces (camera_id,label,polygon) values ($1,'7',$2::jsonb)`, [C, poly])).err);

// membership
await db.query(`insert into property_members values ($1,$2,'reviewer'), ($1,$3,'viewer')`, [P, R, V]);

// isolation: outsider sees nothing, can't write
await as(X);
for (const t of ["properties","cameras","spaces","space_status","space_events","alerts","property_members"])
  ok(`outsider sees 0 rows in ${t}`, (await db.query(`select count(*)::int n from ${t}`)).rows[0].n === 0);
ok("outsider can't insert a camera", !!(await tryQ(`insert into cameras (property_id,name) values ($1,'x')`, [P])).err);
ok("outsider can't make themselves admin", !!(await tryQ(`insert into property_members values ($1,$2,'admin')`, [P, X])).err);
ok("outsider can't read someone's profile", (await db.query(`select count(*)::int n from profiles where id=$1`, [A])).rows[0].n === 0);

// roles
await as(V);
ok("viewer can read the property", (await db.query(`select count(*)::int n from properties`)).rows[0].n === 1);
ok("viewer can't add a space", !!(await tryQ(`insert into spaces (camera_id,label,polygon) values ($1,'9',$2::jsonb)`, [C, poly])).err);
ok("viewer can see teammate profiles", (await db.query(`select count(*)::int n from profiles`)).rows[0].n === 3);
await as(R);
ok("reviewer can't add a space", !!(await tryQ(`insert into spaces (camera_id,label,polygon) values ($1,'9',$2::jsonb)`, [C, poly])).err);

// detector write path: service role only
await as(A);
ok("users can't call record_space_event", !!(await tryQ(`select record_space_event($1,'7','violation',70,now())`, [C])).err);
await as(null, "service_role");
const rec = (label, state, el) => tryQ(`select record_space_event($1,$2,$3,$4,now()) id`, [C, label, state, el]);
ok("unknown space label raises", !!(await rec("99", "parked", 5)).err);
ok("service role records an event", !!(await rec("7", "arriving", null)).rows);
await rec("7", "parked", 12);
let st = (await db.query(`select state, parked_since is not null ps from space_status where space_id=$1`, [S])).rows[0];
ok("status upserted (parked, clock set)", st.state === "parked" && st.ps === true);
ok("no alert while merely parked", (await db.query(`select count(*)::int n from alerts`)).rows[0].n === 0);
await rec("7", "violation", 65);
ok("violation raises exactly one alert", (await db.query(`select count(*)::int n from alerts where status='open' and kind='violation'`)).rows[0].n === 1);
await rec("7", "violation", 66);
ok("repeat violation doesn't duplicate the live alert", (await db.query(`select count(*)::int n from alerts`)).rows[0].n === 1);
await rec("7", "tow_eligible", 361);
ok("tow_eligible raises its own alert", (await db.query(`select count(*)::int n from alerts where kind='tow_eligible'`)).rows[0].n === 1);
ok("status is a single row per space", (await db.query(`select count(*)::int n from space_status`)).rows[0].n === 1);

// review flow
await as(V);
const alertId = (await db.query(`select id from alerts where kind='violation'`)).rows[0].id;
ok("viewer can see alerts", !!alertId);
ok("viewer can't review an alert", !!(await tryQ(`select review_alert($1,'acknowledged')`, [alertId])).err);
ok("viewer can't update alerts directly", (await db.query(`update alerts set status='dismissed'`)).affectedRows === 0);
await as(R);
ok("reviewer can acknowledge", !(await tryQ(`select review_alert($1,'acknowledged','on my way')`, [alertId])).err);
ok("acknowledge records reviewer + note", (await db.query(`select reviewed_by=$2 as me, note from alerts where id=$1`, [alertId, R])).rows[0].me === true);
ok("reviewer can't set arbitrary status", !!(await tryQ(`select review_alert($1,'resolved')`, [alertId])).err);
await as(X);
ok("outsider can't review", !!(await tryQ(`select review_alert($1,'dismissed')`, [alertId])).err);

// leaving resolves; a new violation later raises a NEW alert
await as(null, "service_role");
await rec("7", "empty", null);
ok("space going empty resolves live alerts", (await db.query(`select count(*)::int n from alerts where status in ('open','acknowledged')`)).rows[0].n === 0);
await rec("7", "violation", 70);
ok("a later violation raises a fresh alert", (await db.query(`select count(*)::int n from alerts where status='open'`)).rows[0].n === 1);

// snapshot sync (status without history events)
await as(null, "service_role");
const S2 = (await db.query(`insert into spaces (camera_id,label,polygon) values ($1,'8',$2::jsonb) returning id`, [C, poly])).rows[0].id;
await db.exec(`delete from alerts; delete from space_status; delete from space_events;`);
const evBefore = (await db.query(`select count(*)::int n from space_events`)).rows[0].n;
const sync = (states) => tryQ(`select sync_space_status($1, $2::jsonb) n`, [C, JSON.stringify(states)]);
let r1 = await sync([{label:"7",state:"tow_eligible",elapsed:400},{label:"8",state:"empty",elapsed:null},{label:"99",state:"parked",elapsed:5}]);
ok("sync updates known spaces and ignores unknown labels", r1.rows?.[0].n === 2);
ok("sync writes status rows", (await db.query(`select count(*)::int n from space_status`)).rows[0].n === 2);
ok("sync creates no history events", (await db.query(`select count(*)::int n from space_events`)).rows[0].n === evBefore);
ok("sync raises an alert for a space already tow_eligible", (await db.query(`select count(*)::int n from alerts where kind='tow_eligible' and status='open'`)).rows[0].n === 1);
const ps1 = (await db.query(`select parked_since, updated_at from space_status where space_id=$1`, [S])).rows[0];
await sync([{label:"7",state:"tow_eligible",elapsed:401.3}]);
const ps2 = (await db.query(`select parked_since, updated_at from space_status where space_id=$1`, [S])).rows[0];
ok("re-sync with jitter leaves the row untouched (no realtime churn)", +ps1.parked_since === +ps2.parked_since && +ps1.updated_at === +ps2.updated_at);
await sync([{label:"7",state:"tow_eligible",elapsed:400},{label:"7",state:"tow_eligible",elapsed:400}]);
ok("repeat sync doesn't duplicate the live alert", (await db.query(`select count(*)::int n from alerts`)).rows[0].n === 1);
await sync([{label:"7",state:"empty",elapsed:null}]);
ok("sync of an empty space resolves its alerts", (await db.query(`select count(*)::int n from alerts where status='resolved'`)).rows[0].n === 1);
ok("unknown camera raises", !!(await tryQ(`select sync_space_status(gen_random_uuid(), '[]'::jsonb)`)).err);
await as(A);
ok("users can't call sync_space_status", !!(await tryQ(`select sync_space_status($1, '[]'::jsonb)`, [C])).err);

// the dashboard's alerts-inbox query shape: alerts with embedded space + property
await as(null, "service_role");
await sync([{label:"7",state:"violation",elapsed:70}]);
await as(R);
const inbox = (await db.query(`
  select a.id, a.kind, a.status, a.created_at,
         json_build_object('label', s.label, 'zone', s.zone) as spaces,
         json_build_object('name', p.name) as properties
  from alerts a join spaces s on s.id = a.space_id join properties p on p.id = a.property_id
  where a.status in ('open','acknowledged') order by a.created_at desc`)).rows;
ok("reviewer's inbox query returns the live alert with its space + property", inbox.length === 1 && inbox[0].spaces.label === "7" && inbox[0].properties.name === "Ski Lot");
ok("reviewer role is discoverable by the panel (own membership row)", (await db.query(`select role from property_members where user_id=$1`, [R])).rows[0].role === "reviewer");
await as(X);
ok("an outsider's inbox is empty", (await db.query(`select count(*)::int n from alerts join spaces s on s.id=alerts.space_id`)).rows[0].n === 0);

// notification prefs
await as(V);
ok("member can set own preference", !(await tryQ(`insert into notification_preferences (user_id,property_id,channel) values ($1,$2,'email')`, [V, P])).err);
ok("can't set a preference for someone else", !!(await tryQ(`insert into notification_preferences (user_id,property_id,channel) values ($1,$2,'sms')`, [R, P])).err);
await as(X);
ok("can't subscribe to a property you're not in", !!(await tryQ(`insert into notification_preferences (user_id,property_id,channel) values ($1,$2,'email')`, [X, P])).err);

// anon gets nothing
await as(null, "anon");
ok("anon can't read spaces", !!(await tryQ(`select 1 from spaces`)).err || (await db.query(`select count(*)::int n from spaces`)).rows[0]?.n === 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
