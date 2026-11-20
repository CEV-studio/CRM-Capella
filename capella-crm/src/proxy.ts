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

  // Read the role once per request; the same value guards restricted routes,
  // partner routes and the ACD generator without repeating database calls.
  const { data: profile } = userId && !isPublic
    ? await supabase.from("profiles").select("role,is_active").eq("id",userId).maybeSingle()
    : { data: null };

  if(userId && !isPublic){
    if (!profile?.is_active) {
      await supabase.auth.signOut();
      const url=request.nextUrl.clone();url.pathname='/connexion';url.search='?motif=compte-desactive';
      const denied=path.startsWith('/api/') ? NextResponse.json({error:'Compte désactivé'},{status:403}) : NextResponse.redirect(url);
      for(const cookie of response.cookies.getAll())denied.cookies.set(cookie);
      return denied;
    }
    if(profile.role==='adv'){
      const common=['/changer-mot-de-passe','/deconnexion','/notifications','/api/notifications/lire','/api/partenaires/notifications'].includes(path);
      const read=request.method==='GET' && (['/','/adv','/admin/acd','/suivi-acd','/partenaires/portefeuille','/partenaires/cotations'].includes(path) || /^\/(?:partenaires\/dossiers|pieces|conversion|prospection|popup\/prospect)\/[0-9a-f-]{36}$/i.test(path) || /^\/api\/acd\/[0-9a-f-]{36}(?:\/telecharger)?$/i.test(path));
      const write=request.method==='POST' && (['/adv','/api/partenaires/commandes'].includes(path) || /^\/(?:conversion|prospection|popup\/prospect)\/[0-9a-f-]{36}$/i.test(path)) || request.method==='PATCH' && /^\/api\/acd\/demandes\/[0-9a-f-]{36}$/i.test(path);
      if(!common&&!read&&!write){
        if(path.startsWith('/api/')||request.method!=='GET')return NextResponse.json({error:'Accès réservé'},{status:403});
        const url=request.nextUrl.clone();url.pathname='/adv';url.search='';return NextResponse.redirect(url);
      }
    }
    if(['qualite','be_centre','be_agent'].includes(profile?.role||'')){
      const qualityRoute = profile?.role === 'qualite' &&
        (path === '/qualite' || path.startsWith('/qualite/') || path === '/api/qualite' || path.startsWith('/api/qualite/'));
      const mentionedReviewRoute = /^\/qualite\/[0-9a-f-]{36}$/i.test(path)
        || /^\/api\/qualite\/[0-9a-f-]{36}\/commentaires$/i.test(path)&&request.method==='POST';
      const notificationRoute = (path==='/notifications'||path==='/api/partenaires/notifications')&&request.method==='GET'
        || path==='/api/notifications/lire'&&request.method==='POST';
      const allowed=qualityRoute || mentionedReviewRoute || notificationRoute || path==="/belgique"&&(request.method==="GET"||request.method==="POST") || path==="/api/belgique/clients/export"&&request.method==="GET" || ['be_agent','be_centre'].includes(profile?.role||'')&&path==='/belgique/encoder'&&(request.method==='GET'||request.method==='POST') || path==="/changer-mot-de-passe" || path==="/deconnexion";
      if(!allowed){
        if(path.startsWith("/api/")||request.method!=="GET")return NextResponse.json({error:"Accès réservé"},{status:403});
        const url=request.nextUrl.clone();url.pathname=profile?.role === 'qualite' ? '/qualite' : '/belgique';url.search="";return NextResponse.redirect(url);
      }
    }
  }

  // A partner cannot use the legacy prospecting/commission/API routes.
  const partnerAllowed = ["/partenaires", "/notifications", "/api/partenaires", "/api/notifications", "/pieces", "/changer-mot-de-passe", "/deconnexion"].some(prefix=>path===prefix||path.startsWith(prefix+"/"));
  if (userId && !isPublic && !partnerAllowed) {
    if(profile?.role === "apporteur") {
      {
        if(path.startsWith("/api/")||request.method!=="GET")return NextResponse.json({error:"Accès réservé"},{status:403});
        const url=request.nextUrl.clone();url.pathname="/partenaires/opportunites";url.search="";
        return NextResponse.redirect(url);
      }
    }
  }

  // Générateur ACD : réservé au traitement ADV et à l’administration.
  // La route serveur /demander peut l'appeler avec le secret interne,
  // qui n'est jamais envoyé au navigateur du commercial.
  const isAcdGenerator = /^\/api\/acd\/[^/]+$/.test(path);
  if (userId && isAcdGenerator && request.method === "GET") {
    const givenSecret = request.headers.get("x-capella-internal-secret") ?? "";
    const internalSecret = process.env.FORM_WEBHOOK_SECRET ?? "";
    const internalCall = Boolean(internalSecret) && givenSecret === internalSecret;

    if (!internalCall) {
      if (!profile?.is_active || !["admin","adv"].includes(profile.role)) {
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
