import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/domain/database.types";

/**
 * Client Supabase côté serveur (pages, layouts, server actions).
 * Il porte la session de l'utilisateur connecté : les politiques RLS
 * s'appliquent exactement comme dans le navigateur.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Appelé depuis un Server Component : le rafraîchissement de session
            // est déjà géré par le middleware, on peut ignorer.
          }
        },
      },
    },
  );
}
