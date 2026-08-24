"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/domain/database.types";

/**
 * Client Supabase utilisé dans le navigateur.
 * Il ne connaît que la clé publique : toute la sécurité repose sur RLS.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
