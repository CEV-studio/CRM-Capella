import Link from "next/link";
import { notFound } from "next/navigation";
import { peutGerer, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { StageBadge } from "@/components/ui";
import { isTransferable, stageColor } from "@/lib/domain/stages";
import { fmtDateHeure } from "@/lib/format";
import { nomComplet } from "@/lib/domain/noms";
import { BoutonSupprimer } from "../../admin/corbeille/bouton-supprimer";
import { PiecesJointes } from "@/components/pieces-jointes";
import { EmailClient } from "@/components/email-client";
import { FicheForm } from "../fiche-form";
import { chargerSources, chargerChampsPersonnalises } from "@/lib/referentiels";
import { getActiveGmailAccount } from "@/lib/gmail";
import type { EmailMessage, EmailTemplate, PieceJointe, Prospect, Profile } from "@/lib/domain/database.types";

export const dynamic = "force-dynamic";

export default async function FicheProspectPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ acd?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const profil = await requireProfile();
  const estAdmin = profil.role === "admin";
  const supabase = await createClient();

  const { data: prospect } = await supabase.from("prospects").select("*").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!prospect) notFound();

  const [sources, { data: profils }, { data: affaireLiee }, { data: piecesData }, champsPerso, { data: templateData }, { data: messageData }, gmailAccount] = await Promise.all([
    chargerSources(),
    estAdmin ? supabase.from("profiles").select("id, full_name").eq("is_active", true).order("full_name") : Promise.resolve({ data: [] as Pick<Profile, "id" | "full_name">[] }),
    supabase.from("affaires").select("id, ref").eq("prospect_id", id).is("deleted_at", null).maybeSingle(),
    supabase.from("pieces_jointes").select("*").eq("prospect_id", id).order("created_at"),
    chargerChampsPersonnalises(),
    supabase.from("email_templates").select("*").eq("is_active", true).order("sort_order").order("name"),
    supabase.from("email_messages").select("*").eq("prospect_id", id).order("sent_at", { ascending: false }).limit(100),
    getActiveGmailAccount().catch(() => null),
  ]);

  const p = prospect as Prospect;
  const pretATransferer = isTransferable(p.stage);
  const pieces = (piecesData ?? []) as PieceJointe[];
  const piecesVisibles = estAdmin ? pieces : pieces.filter((x) => x.type !== "ACD");
  const templates = (templateData ?? []) as EmailTemplate[];
  const messages = (messageData ?? []) as EmailMessage[];
  const fournisseur = p.fournisseur_electricite || p.fournisseur_gaz || "";
  const variables: Record<string, string> = {
    prenom: p.prenom || "",
    nom: p.nom || "",
    societe: p.raison_sociale || "",
    email: p.mail || "",
    commercial: profil.full_name,
    ref: p.ref || "",
    siren: p.siren || "",
    pdl: p.pdl || "",
    pce: p.pce || "",
    fournisseur,
    date_echeance: p.date_fin_contrat || "",
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8">
      <Link href="/prospection" className="text-sm text-grey-brand underline underline-offset-2 hover:text-navy-700">← Retour à la prospection</Link>

      {query.acd === "transmise" ? (
        <div className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-800">Demande ACD transmise à l’administrateur.</div>
      ) : null}

      <header className="mt-3 mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-800">{p.raison_sociale || nomComplet(p.nom, p.prenom)}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-grey-brand">
            <StageBadge label={p.stage} color={stageColor(p.stage, "prospect")} />
            <span className="tabular">{p.ref}</span><span>· dernière action {fmtDateHeure(p.last_action_at)}</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link href={`/outils/comparatif?prospect=${p.id}`} className="inline-flex h-9 items-center rounded-lg border border-navy-200 bg-white px-3 text-sm font-semibold text-navy-700 hover:bg-navy-50">Générer un comparatif</Link>
            <Link href={`/outils/resiliation?prospect=${p.id}`} className="inline-flex h-9 items-center rounded-lg border border-navy-200 bg-white px-3 text-sm font-semibold text-navy-700 hover:bg-navy-50">Lettre de résiliation</Link>
            {p.stage === "Demande ACD" ? (
              estAdmin ? (
                <a href={`/api/acd/${p.id}`} className="inline-flex h-9 items-center rounded-lg bg-star-500 px-3 text-sm font-semibold text-white hover:bg-star-600">Télécharger une ACD</a>
              ) : (
                <form action={`/api/acd/${p.id}/demander`} method="post">
                  <button type="submit" className="inline-flex h-9 items-center rounded-lg bg-star-500 px-3 text-sm font-semibold text-white hover:bg-star-600">Demander l&apos;ACD</button>
                </form>
              )
            ) : null}
            {peutGerer(profil) ? <BoutonSupprimer cible="prospect" id={p.id} libelle={p.raison_sociale || nomComplet(p.nom, p.prenom)} retour="/prospection" /> : null}
          </div>
        </div>
        {affaireLiee ? (
          <Link href={`/conversion/${affaireLiee.id}`} className="max-w-xs rounded-[var(--radius-card)] px-4 py-3 text-sm text-navy-800 hover:opacity-90" style={{ backgroundColor: "var(--color-status-signe)" }}><strong>Déjà converti en affaire.</strong><span className="mt-0.5 block text-xs">Voir l&apos;affaire {affaireLiee.ref} →</span></Link>
        ) : pretATransferer ? (
          <div className="max-w-sm rounded-[var(--radius-card)] px-4 py-3 text-sm text-navy-800" style={{ backgroundColor: "var(--color-status-avance)" }}><strong>Prêt à basculer en affaire.</strong><p className="mt-0.5 mb-2 text-xs">La fiche affaire sera pré-remplie ; ce prospect est conservé.</p><Link href={`/conversion/nouvelle?prospect=${p.id}`} className="inline-flex h-9 items-center rounded-lg bg-star-500 px-3 text-sm font-semibold text-white hover:bg-star-600">Convertir en affaire</Link></div>
        ) : null}
      </header>

      <FicheForm prospect={p} estAdmin={estAdmin} sources={sources.filter((s) => s.is_active).map((s) => ({ value: s.id, label: s.name }))} champsPerso={champsPerso.map((c) => ({ cle: c.cle, libelle: c.libelle }))} commerciaux={(profils ?? []).map((c) => ({ value: c.id, label: c.full_name }))} />
      <div className="mt-6">
        <EmailClient
          prospectId={p.id}
          prospectEmail={p.mail}
          variables={variables}
          templates={templates.map((t) => ({ id: t.id, name: t.name, subject: t.subject, body: t.body }))}
          messages={messages}
          pieces={piecesVisibles.map((piece) => ({ id: piece.id, file_name: piece.file_name, type: piece.type }))}
          gmailConnected={Boolean(gmailAccount)}
          estAdmin={estAdmin}
        />
      </div>
      <div className="mt-6"><PiecesJointes scope="prospect" parentId={p.id} pieces={piecesVisibles} /></div>
    </main>
  );
}
