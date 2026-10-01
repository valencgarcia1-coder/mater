// Fired by a Database Webhook on insert into public.alerts. Texts every
// property member who has SMS enabled for this alert's kind, with the
// evidence photo attached (MMS) when one exists.
//
// This is the dispatch *notification* — it tells a person to look. It never
// decides a tow is happening and never talks to a towing company; that's
// still a human acting on the text, same as the dashboard's review step.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;
const TWILIO_FROM = Deno.env.get("TWILIO_FROM_NUMBER")!;

const restHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

type AlertRow = {
  id: string;
  property_id: string;
  space_id: string;
  kind: "violation" | "tow_eligible";
  evidence_path: string | null;
};

Deno.serve(async (req) => {
  const payload = await req.json();
  if (payload.table !== "alerts" || payload.type !== "INSERT") {
    return new Response("ignored", { status: 200 });
  }
  const alert = payload.record as AlertRow;

  const [space, property] = await Promise.all([
    fetchOne(`spaces?id=eq.${alert.space_id}&select=label`),
    fetchOne(`properties?id=eq.${alert.property_id}&select=name`),
  ]);

  const prefs = await fetchAll(
    `notification_preferences?property_id=eq.${alert.property_id}` +
      `&channel=eq.sms&enabled=eq.true&kinds=cs.{${alert.kind}}&select=user_id`,
  );
  if (prefs.length === 0) return new Response("no subscribers", { status: 200 });

  const userIds = prefs.map((p: { user_id: string }) => p.user_id);
  const profiles = (
    await fetchAll(`profiles?id=in.(${userIds.join(",")})&select=id,phone_number`)
  ).filter((p: { phone_number: string | null }) => !!p.phone_number);

  const mediaUrl = alert.evidence_path ? await signEvidenceUrl(alert.evidence_path) : null;

  const kindLabel = alert.kind === "tow_eligible" ? "TOW ELIGIBLE" : "VIOLATION";
  const body = `Mater: ${kindLabel} — ${property?.name ?? "a property"}, space ${space?.label ?? "?"}.`;

  const results = await Promise.allSettled(
    profiles.map((p: { phone_number: string }) => sendTwilioSms(p.phone_number, body, mediaUrl)),
  );
  const sent = results.filter((r) => r.status === "fulfilled").length;
  for (const r of results) if (r.status === "rejected") console.error("sms failed:", r.reason);
  return new Response(JSON.stringify({ sent, of: profiles.length }), { status: 200 });
});

async function fetchOne(path: string) {
  const rows = await fetchAll(path);
  return rows[0] ?? null;
}

async function fetchAll(path: string) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: restHeaders });
  if (!resp.ok) throw new Error(`rest ${path} -> ${resp.status}: ${await resp.text()}`);
  return resp.json();
}

// Evidence lives in a private bucket — a signed URL is the only way Twilio
// (fetching the MediaUrl itself) can actually load the photo. A day's worth
// of validity is plenty of time for someone to open the text.
async function signEvidenceUrl(path: string): Promise<string | null> {
  const resp = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/evidence/${path}?expiresIn=86400`, {
    method: "POST",
    headers: restHeaders,
  });
  if (!resp.ok) {
    console.error("evidence sign failed:", resp.status, await resp.text());
    return null;
  }
  const { signedURL } = await resp.json();
  return `${SUPABASE_URL}/storage/v1${signedURL}`;
}

async function sendTwilioSms(to: string, body: string, mediaUrl: string | null) {
  const form = new URLSearchParams({ To: to, From: TWILIO_FROM, Body: body });
  if (mediaUrl) form.set("MediaUrl", mediaUrl);
  const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });
  if (!resp.ok) throw new Error(`twilio ${resp.status}: ${await resp.text()}`);
}
