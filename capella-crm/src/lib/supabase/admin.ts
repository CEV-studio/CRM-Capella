import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/domain/database.types";

/**
 * Client d'administration — clé de service, ignore RLS.
 *
 * ⚠️  À n'utiliser QUE dans du code serveur, et uniquement pour les
 * opérations que seul l'admin peut déclencher (création de compte
 * commercial, réattribution en masse, export complet).
 * Chaque appel doit être précédé d'une vérification explicite du rôle
 * de l'appelant : voir `requireAdmin()` dans src/lib/auth.ts.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY manquante : ajoute-la dans .env.local (et dans Vercel).",
    );
  }

  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
