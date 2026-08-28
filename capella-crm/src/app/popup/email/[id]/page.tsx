import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EmailClient } from "@/components/email-client";
import { getGmailAccountForProfile } from "@/lib/gmail-account";
import type { EmailMessage, EmailTemplate, PieceJointe, Prospect } from "@/lib/domain/database.types";

export const dynamic = "force-dynamic";

export default async function EmailPopupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: prospect }, { data: templateData }, { data: messageData }, { data: piecesData }, gmailAccount] = await Promise.all([
    supabase.from("prospects").select("*").eq("id", id).is("deleted_at", null).maybeSingle(),
    supabase.from("email_templates").select("*").eq("is_active", true).order("sort_order").order("name"),
    supabase.from("email_messages").select("*").eq("prospect_id", id).order("sent_at", { ascending: false }).limit(100),
    supabase.from("pieces_jointes").select("*").eq("prospect_id", id).order("created_at"),
    getGmailAccountForProfile(profile.id, "read").catch(() => null),
  ]);

  if (!prospect) notFound();
  const p = prospect as Prospect;
  const templates = (templateData ?? []) as EmailTemplate[];
  const messages = (messageData ?? []) as EmailMessage[];
  const pieces = (piecesData ?? []) as PieceJointe[];
  const piecesVisibles = profile.role === "admin" ? pieces : pieces.filter((piece) => piece.type !== "ACD");
  const fournisseur = p.fournisseur_electricite || p.fournisseur_gaz || "";
  const variables: Record<string, string> = {
    prenom: p.prenom || "", nom: p.nom || "", societe: p.raison_sociale || "", email: p.mail || "",
    commercial: profile.full_name, ref: p.ref || "", siren: p.siren || "", pdl: p.pdl || "", pce: p.pce || "",
    fournisseur, date_echeance: p.date_fin_contrat || "",
  };

  return <main className="min-h-screen bg-white p-4 md:p-5">
    <EmailClient
      prospectId={p.id}
      prospectEmail={p.mail}
      variables={variables}
      templates={templates.map((t) => ({ id: t.id, name: t.name, subject: t.subject, body: t.body }))}
      messages={messages}
      pieces={piecesVisibles.map((piece) => ({ id: piece.id, file_name: piece.file_name, type: piece.type }))}
      gmailConnected={Boolean(gmailAccount)}
      estAdmin={profile.role === "admin"}
    />
  </main>;
}
