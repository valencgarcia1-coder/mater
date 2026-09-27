// Supabase is optional: without both variables the dashboard behaves exactly
// as it did before (no login, no alerts inbox). Once they're set, /dashboard
// requires a signed-in user and every query is limited by the database's
// row-level security to the properties that user belongs to.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);
