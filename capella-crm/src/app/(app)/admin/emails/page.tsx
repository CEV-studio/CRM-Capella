import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { creerTemplate, modifierTemplate, supprimerTemplate } from "./actions";
import type { EmailAccount, EmailTemplate } from "@/lib/domain/database.types";

export const dynamic = "force-dynamic";

const BALISES = [
  "{{prenom}}", "{{nom}}", "{{societe}}", "{{email}}", "{{commercial}}", "{{ref}}",
  "{{siren}}", "{{pdl}}", "{{pce}}", "{{fournisseur}}", "{{date_echeance}}",
];

export default async function AdminEmailsPage({ searchParams }: {
  searchParams: Promise<{ gmail?: string; message?: string }>;
}) {
  await requireAdmin();
  const query = await searchParams;
  const supabase = await createClient();

  const [{ data: accountData, error: accountError }, { data: templateData, error: templateError }] = await Promise.all([
    supabase.from("email_accounts").select("*").eq("is_active", true).order("connected_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("email_templates").select("*").order("sort_order").order("name"),
  ]);

  const account = accountData as EmailAccount | null;
  const templates = (templateData ?? []) as EmailTemplate[];
  const oauthConfigured = Boolean(
    process.env.GOOGLE_GMAIL_CLIENT_ID &&
    process.env.GOOGLE_GMAIL_CLIENT_SECRET &&
    process.env.GMAIL_TOKEN_ENCRYPTION_KEY,
  );
  const schemaMissing = accountError?.message?.includes("email_accounts") || templateError?.message?.includes("email_templates");

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      <h1 className="font-display text-2xl font-bold text-navy-800">Emails & templates</h1>
      <p className="mt-1 text-sm text-grey-brand">Configure la boîte Gmail utilisée par l’équipe et les modèles disponibles depuis les fiches clients.</p>

      {query.gmail === "connecte" ? <div className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-800">Boîte Gmail connectée.</div> : null}
      {query.gmail === "deconnecte" ? <div className="mt-4 rounded-lg bg-navy-50 px-4 py-3 text-sm text-navy-700">Boîte Gmail déconnectée.</div> : null}
      {query.gmail === "erreur" ? <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">Connexion Gmail impossible : {query.message || "erreur inconnue"}</div> : null}
      {schemaMissing ? <div className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">La migration Gmail n’est pas encore appliquée dans Supabase. Exécute <strong>0009_gmail_crm.sql</strong> avant d’utiliser cette page.</div> : null}

      <section className="mt-6 rounded-xl border border-navy-100 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-navy-800">Boîte d’envoi Gmail</h2>
            {account ? (
              <p className="mt-1 text-sm text-grey-brand"><strong className="text-navy-700">{account.email}</strong> · nom affiché : {account.display_name || "Capella Energy"}</p>
            ) : (
              <p className="mt-1 text-sm text-grey-brand">Aucune boîte Gmail active.</p>
            )}
          </div>
          <div className="flex gap-2">
            {account ? (
              <form action="/api/gmail/disconnect" method="post">
                <button className="h-9 rounded-lg border border-navy-200 px-3 text-sm font-semibold text-navy-700 hover:bg-navy-50">Déconnecter</button>
              </form>
            ) : oauthConfigured && !schemaMissing ? (
              <a href="/api/gmail/connect" className="inline-flex h-9 items-center rounded-lg bg-star-500 px-3 text-sm font-semibold text-white hover:bg-star-600">Connecter Gmail</a>
            ) : (
              <span className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">Configuration Google OAuth requise</span>
            )}
          </div>
        </div>
        {!oauthConfigured ? (
          <p className="mt-3 text-xs text-grey-brand">Variables Vercel nécessaires : GOOGLE_GMAIL_CLIENT_ID, GOOGLE_GMAIL_CLIENT_SECRET et GMAIL_TOKEN_ENCRYPTION_KEY.</p>
        ) : null}
      </section>

      <section className="mt-6 rounded-xl border border-navy-100 bg-white p-5">
        <h2 className="font-semibold text-navy-800">Balises disponibles</h2>
        <div className="mt-3 flex flex-wrap gap-2">{BALISES.map((b) => <code key={b} className="rounded bg-navy-50 px-2 py-1 text-xs text-navy-700">{b}</code>)}</div>
        <p className="mt-2 text-xs text-grey-brand">Les balises sont remplacées lors du choix du template. Le commercial peut ensuite modifier librement l’objet et le contenu avant l’envoi.</p>
      </section>

      <section className="mt-6 rounded-xl border border-navy-100 bg-white p-5">
        <h2 className="font-semibold text-navy-800">Créer un template</h2>
        <form action={creerTemplate} className="mt-4 grid gap-3">
          <input name="name" required placeholder="Nom du template — ex. Envoi comparatif" className="h-10 rounded-lg border border-navy-200 px-3 text-sm" />
          <input name="subject" placeholder="Objet — ex. Votre étude {{societe}}" className="h-10 rounded-lg border border-navy-200 px-3 text-sm" />
          <textarea name="body" rows={7} placeholder="Bonjour {{prenom}}, ..." className="rounded-lg border border-navy-200 px-3 py-2 text-sm" />
          <div><button className="h-9 rounded-lg bg-star-500 px-4 text-sm font-semibold text-white hover:bg-star-600">Créer le template</button></div>
        </form>
      </section>

      <section className="mt-6 space-y-4">
        {templates.map((template) => (
          <div key={template.id} className="rounded-xl border border-navy-100 bg-white p-5">
            <form action={modifierTemplate} className="grid gap-3">
              <input type="hidden" name="id" value={template.id} />
              <div className="grid gap-3 sm:grid-cols-[1fr_120px_auto]">
                <input name="name" required defaultValue={template.name} className="h-10 rounded-lg border border-navy-200 px-3 text-sm font-semibold text-navy-800" />
                <input name="sort_order" type="number" defaultValue={template.sort_order} className="h-10 rounded-lg border border-navy-200 px-3 text-sm" title="Ordre" />
                <label className="flex items-center gap-2 text-sm text-navy-700"><input name="is_active" type="checkbox" defaultChecked={template.is_active} /> Actif</label>
              </div>
              <input name="subject" defaultValue={template.subject} className="h-10 rounded-lg border border-navy-200 px-3 text-sm" />
              <textarea name="body" rows={7} defaultValue={template.body} className="rounded-lg border border-navy-200 px-3 py-2 text-sm" />
              <div className="flex gap-2">
                <button className="h-9 rounded-lg bg-navy-800 px-4 text-sm font-semibold text-white hover:bg-navy-700">Enregistrer</button>
              </div>
            </form>
            <form action={supprimerTemplate} className="mt-2">
              <input type="hidden" name="id" value={template.id} />
              <button className="text-xs text-red-700 underline underline-offset-2">Supprimer le template</button>
            </form>
          </div>
        ))}
        {!templates.length && !templateError ? <p className="text-sm text-grey-brand">Aucun template pour le moment.</p> : null}
      </section>
    </main>
  );
}
