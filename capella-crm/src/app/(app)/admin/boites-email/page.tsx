import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { EmailAccount, EmailAccountMember, Profile } from "@/lib/domain/database.types";
import { attribuerBoitePartagee, retirerBoitePartagee } from "./actions";

export const dynamic = "force-dynamic";

export default async function BoitesEmailPage({ searchParams }: {
  searchParams: Promise<{ gmail?: string; message?: string }>;
}) {
  await requireAdmin();
  const query = await searchParams;
  const supabase = await createClient();

  const [{ data: accountData }, { data: profileData }, { data: memberData }] = await Promise.all([
    supabase.from("email_accounts").select("*").eq("is_shared", true).order("connected_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name, email, role, is_active").eq("is_active", true).order("full_name"),
    supabase.from("email_account_members").select("*").order("created_at"),
  ]);

  const accounts = (accountData ?? []) as EmailAccount[];
  const profiles = (profileData ?? []) as Pick<Profile, "id" | "full_name" | "email" | "role" | "is_active">[];
  const members = (memberData ?? []) as EmailAccountMember[];
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const oauthConfigured = Boolean(
    process.env.GOOGLE_GMAIL_CLIENT_ID &&
    process.env.GOOGLE_GMAIL_CLIENT_SECRET &&
    process.env.GMAIL_TOKEN_ENCRYPTION_KEY,
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-800">Boîtes e-mail partagées</h1>
          <p className="mt-1 max-w-2xl text-sm text-grey-brand">
            Une boîte comme hello@capellaenergy.fr n’est visible que par les commerciaux que tu autorises ici. Leur signature CRM personnelle reste utilisée lors de l’envoi.
          </p>
        </div>
        {oauthConfigured ? (
          <a href="/api/gmail/connect?mode=shared&return_to=/admin/boites-email" className="inline-flex h-9 items-center rounded-lg bg-star-500 px-4 text-sm font-semibold text-white hover:bg-star-600">
            Connecter une boîte partagée
          </a>
        ) : null}
      </div>

      {query.gmail === "connecte" ? <div className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-800">Boîte partagée connectée.</div> : null}
      {query.gmail === "deconnecte" ? <div className="mt-4 rounded-lg bg-navy-50 px-4 py-3 text-sm text-navy-700">Boîte partagée déconnectée.</div> : null}
      {query.gmail === "erreur" ? <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-800">Gmail : {query.message || "erreur inconnue"}</div> : null}

      <div className="mt-6 space-y-5">
        {accounts.map((account) => {
          const accountMembers = members.filter((member) => member.email_account_id === account.id);
          const availableProfiles = profiles.filter((profile) => !accountMembers.some((member) => member.profile_id === profile.id));
          return (
            <section key={account.id} className="rounded-xl border border-navy-100 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-navy-800">{account.email}</h2>
                  <p className="mt-1 text-xs text-grey-brand">{account.is_active ? "Active" : "Déconnectée"} · {accountMembers.length} utilisateur(s) autorisé(s)</p>
                </div>
                {account.is_active ? (
                  <form action="/api/gmail/disconnect" method="post">
                    <input type="hidden" name="account_id" value={account.id} />
                    <input type="hidden" name="return_to" value="/admin/boites-email" />
                    <button className="h-8 rounded-lg border border-navy-200 px-3 text-xs font-semibold text-navy-700 hover:bg-navy-50">Déconnecter</button>
                  </form>
                ) : (
                  <a href="/api/gmail/connect?mode=shared&return_to=/admin/boites-email" className="text-xs font-semibold text-star-600 underline underline-offset-2">Reconnecter via Google</a>
                )}
              </div>

              {accountMembers.length ? (
                <div className="mt-4 space-y-2">
                  {accountMembers.map((member) => {
                    const profile = profileById.get(member.profile_id);
                    return (
                      <div key={member.profile_id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-navy-50 px-3 py-2">
                        <div className="text-sm text-navy-800">
                          <strong>{profile?.full_name || "Utilisateur"}</strong>
                          <span className="ml-2 text-xs text-grey-brand">{profile?.email || ""}{member.is_default ? " · prioritaire" : ""}</span>
                        </div>
                        <form action={retirerBoitePartagee}>
                          <input type="hidden" name="account_id" value={account.id} />
                          <input type="hidden" name="profile_id" value={member.profile_id} />
                          <button className="text-xs font-semibold text-red-700 underline underline-offset-2">Retirer l’accès</button>
                        </form>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-4 text-sm text-grey-brand">Aucun commercial n’a accès à cette boîte pour le moment.</p>
              )}

              {account.is_active && availableProfiles.length ? (
                <form action={attribuerBoitePartagee} className="mt-4 flex flex-wrap items-end gap-3 border-t border-navy-100 pt-4">
                  <input type="hidden" name="account_id" value={account.id} />
                  <label className="grid gap-1 text-xs font-semibold text-navy-700">
                    Donner accès à
                    <select name="profile_id" required className="h-9 min-w-64 rounded-lg border border-navy-200 bg-white px-3 text-sm font-normal">
                      <option value="">Choisir un utilisateur</option>
                      {availableProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name} — {profile.email}</option>)}
                    </select>
                  </label>
                  <label className="flex h-9 items-center gap-2 text-xs text-navy-700">
                    <input type="checkbox" name="is_default" /> Prioritaire si aucune boîte personnelle
                  </label>
                  <button className="h-9 rounded-lg bg-navy-800 px-4 text-sm font-semibold text-white hover:bg-navy-700">Autoriser</button>
                </form>
              ) : null}
            </section>
          );
        })}

        {!accounts.length ? (
          <section className="rounded-xl border border-dashed border-navy-200 bg-white p-8 text-center">
            <p className="text-sm text-grey-brand">Aucune boîte partagée configurée.</p>
            {oauthConfigured ? <a href="/api/gmail/connect?mode=shared&return_to=/admin/boites-email" className="mt-3 inline-flex h-9 items-center rounded-lg bg-star-500 px-4 text-sm font-semibold text-white">Connecter hello@…</a> : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}
