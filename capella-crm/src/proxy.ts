import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Rafraîchit la session à chaque navigation et bloque l'accès à l'application
 * tant que l'utilisateur n'est pas connecté.
 *
 * Ce middleware est une commodité, PAS la sécurité : l'isolation des données
 * entre commerciaux est assurée par les politiques RLS dans Postgres.
 */
export default async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Tant que les clés Supabase ne sont pas renseignées, on laisse passer :
  // l'application affiche alors sa page de diagnostic au lieu de planter.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // `getUser()` interroge l'API Auth à chaque navigation. Avec les clés de
  // signature asymétriques de Supabase, `getClaims()` vérifie le jeton signé
  // localement après mise en cache de la clé publique : même contrôle, sans
  // imposer un aller-retour réseau à chaque clic dans le CRM.
  const { data: token } = await supabase.auth.getClaims();
  const userId = typeof token?.claims?.sub === "string" ? token.claims.sub : null;

  const path = request.nextUrl.pathname;
  const isPublic = path.startsWith("/connexion") || path.startsWith("/auth");

  if (!userId && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    url.searchParams.set("suite", path);
    return NextResponse.redirect(url);
  }

  if (userId && path === "/connexion") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Tout sauf les fichiers statiques et les images.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
