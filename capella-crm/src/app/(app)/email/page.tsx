import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { EmailAccount, EmailAccountMember } from "@/lib/domain/database.types";

export const dynamic = "force-dynamic";

export default async function MonEmailPage({ searchParams }: {
  searchParams: Promise<{ gmail?: string; message?: string }>;
}) {
  const profile = await requireProfile();
  const query = await searchParams;
  const supabase = await createClient();

  const [{ data: personalData }, { data: memberData }] = await Promise.all([
    supabase
      .from("email_accounts")
      .select("*")
      .eq("owner_profile_id", profile.id)
      .eq("is_shared", false)
      .order("connected_at", { ascending: false }),
    supabase
      .from("email_account_members")
      .select("*")
      .eq("profile_id", profile.id)
      .eq("can_read", true)
      .order("is_default", { ascending: false }),
  ]);

  const personalAccounts = (personalData ?? []) as EmailAccount[];
  const activePersonal = personalAccounts.find((account) => account.is_active) ?? null;
  const memberships = (memberData ?? []) as EmailAccountMember[];
  const sharedIds = memberships.map((membership) => membership.email_account_id);
  const { data: sharedData } = sharedIds.length
    ? await supabase.from("email_accounts").select("*").in("id", sharedIds).eq("is_shared", true).eq("is_active", true)
    : { data: [] };
  const sharedAccounts = (sharedData ?? []) as EmailAccount[];
  const memberByAccount = new Map(memberships.map((member) => [member.email_account_id, member]));

  const oauthConfigured = Boolean(
    process.env.GOOGLE_GMAIL_CLIENT_ID &&
    process.env.GOOGLE_GMAIL_CLIENT_SECRET &&
    process.env.GMAIL_TOKEN_ENCRYPTION_KEY,
  );

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-8">
      <h1 className="font-display text-2xl font-bold text-navy-800">Mon email</h1>
      <p className="mt-1 text-sm text-grey-brand">
        Ta connexion Gmail est personnelle à ton compte CRM. Tu ne vois que tes propres échanges et ceux des boîtes partagées qui t’ont été explicitement attribuées.
      </p>

      {query.gmail === "connecte" ? <div className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-800">Boîte Gmail connectée à ton compte CRM.</div> : null}
      {query.gmail === "deconnecte" ? <div className="mt-4 rounded-lg bg-navy-50 px-4 py-3 text-sm text-navy-700">Boîte Gmail déconnectée.</div> : null}
      {query.gmail === "erreur" ? <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-800">Gmail : {query.message || "erreur inconnue"}</div> : null}

      <section className="mt-6 rounded-xl border border-navy-100 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-navy-800">Ma boîte personnelle</h2>
            {activePersonal ? (
              <p className="mt-1 text-sm text-grey-brand">
                Connectée : <strong className="text-navy-700">{activePersonal.email}</strong>
              </p>
            ) : (
              <p className="mt-1 text-sm text-grey-brand">Aucune boîte Gmail personnelle connectée.</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {oauthConfigured ? (
              <a href="/api/gmail/connect?return_to=/email" className="inline-flex h-9 items-center rounded-lg bg-star-500 px-4 text-sm font-semibold text-white hover:bg-star-600">
                {activePersonal ? "Reconnecter / changer" : "Connecter Gmail"}
              </a>
            ) : (
              <span className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">OAuth Google non configuré</span>
            )}
            {activePersonal ? (
              <form action="/api/gmail/disconnect" method="post">
                <input type="hidden" name="account_id" value={activePersonal.id} />
                <input type="hidden" name="return_to" value="/email" />
                <button className="h-9 rounded-lg border border-navy-200 px-3 text-sm font-semibold text-navy-700 hover:bg-navy-50">Déconnecter</button>
              </form>
            ) : null}
          </div>
        </div>
        <p className="mt-4 rounded-lg bg-navy-50 px-3 py-2 text-xs text-navy-700">
          Les messages de cette boîte restent privés à ton compte CRM. Un autre commercial ne peut pas les consulter simplement parce qu’il possède la même fiche prospect.
        </p>
      </section>

      <section className="mt-6 rounded-xl border border-navy-100 bg-white p-5">
        <h2 className="font-semibold text-navy-800">Boîtes partagées autorisées</h2>
        <p className="mt-1 text-sm text-grey-brand">Par exemple hello@capellaenergy.fr. Seul un administrateur peut t’accorder ou retirer cet accès.</p>

        {sharedAccounts.length ? (
          <div className="mt-4 space-y-3">
            {sharedAccounts.map((account) => {
              const membership = memberByAccount.get(account.id);
              return (
                <div key={account.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-navy-100 p-3">
                  <div>
                    <div className="text-sm font-semibold text-navy-800">{account.email}</div>
                    <div className="mt-0.5 text-xs text-grey-brand">
                      {membership?.can_send ? "Lecture + envoi autorisés" : "Lecture uniquement"}
                      {membership?.is_default ? " · boîte partagée prioritaire" : ""}
                    </div>
                  </div>
                  <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-800">Partagée</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-4 text-sm text-grey-brand">Aucune boîte partagée ne t’est attribuée.</p>
        )}
      </section>
    </main>
  );
}
