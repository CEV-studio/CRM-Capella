import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Rafraîchit la session à chaque navigation et bloque l'accès à l'application
 * tant que l'utilisateur n'est pas connecté.
 *
 * La sécurité métier reste assurée par RLS, avec ici un garde-fou supplémentaire
 * pour empêcher le téléchargement direct d'une ACD par un commercial.
 */
export default async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

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
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

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

  // Générateur ACD : accessible directement uniquement à l'admin.
  // La route serveur /demander peut l'appeler avec le secret interne,
  // qui n'est jamais envoyé au navigateur du commercial.
  const isAcdGenerator = /^\/api\/acd\/[^/]+$/.test(path);
  if (userId && isAcdGenerator && request.method === "GET") {
    const givenSecret = request.headers.get("x-capella-internal-secret") ?? "";
    const internalSecret = process.env.FORM_WEBHOOK_SECRET ?? "";
    const internalCall = Boolean(internalSecret) && givenSecret === internalSecret;

    if (!internalCall) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      if (profile?.role !== "admin") {
        return new NextResponse("Accès réservé à l'administrateur", { status: 403 });
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
