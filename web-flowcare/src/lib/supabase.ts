import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.EXPO_PUBLIC_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = Boolean(url && anonKey);

export const supabase = createClient(url ?? "https://invalid.supabase.co", anonKey ?? "missing", {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: "fc.admin.session" },
});
