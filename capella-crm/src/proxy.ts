import { canAccessPath, hasPermission, homePath } from '@/lib/permissions';
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

  // Read permissions once per request; the same value guards restricted routes,
  // partner routes and the ACD generator without repeating database calls.
  const { data: profile } = userId && !isPublic
    ? await supabase.from("profiles").select("permissions,is_active").eq("id",userId).maybeSingle()
    : { data: null };

  if(userId && !isPublic){
    if (!profile?.is_active) {
      await supabase.auth.signOut();
      const url=request.nextUrl.clone();url.pathname='/connexion';url.search='?motif=compte-desactive';
      const denied=path.startsWith('/api/') ? NextResponse.json({error:'Compte désactivé'},{status:403}) : NextResponse.redirect(url);
      for(const cookie of response.cookies.getAll())denied.cookies.set(cookie);
      return denied;
    }
    const internalSecret=process.env.FORM_WEBHOOK_SECRET;
    const internalGenerator=Boolean(internalSecret)&&request.headers.get('x-capella-internal-secret')===internalSecret&&hasPermission(profile,'crm')&&/^\/api\/acd\/[^/]+$/.test(path);
    if(!canAccessPath(profile,path,request.method)&&!internalGenerator){
      if(path.startsWith('/api/')||request.method!=='GET')return NextResponse.json({error:'Permission requise'},{status:403});
      const url=request.nextUrl.clone();url.pathname=homePath(profile);url.search='';return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
