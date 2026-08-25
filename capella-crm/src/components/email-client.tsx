"use client";

import { useEffect, useMemo, useState } from "react";
import type { EmailMessage } from "@/lib/domain/database.types";

type TemplateLite = { id: string; name: string; subject: string; body: string };
type PieceLite = { id: string; file_name: string; type: "ACD" | "Facture" };

function injecterBalises(text: string, variables: Record<string, string>): string {
  return text.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, key: string) => variables[key] ?? "");
}

function dateEmail(value: string | null): string {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function poidsFichier(octets: number): string {
  if (octets < 1024 * 1024) return `${Math.max(1, Math.round(octets / 1024))} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}

export function EmailClient({
  prospectId,
  prospectEmail,
  variables,
  templates,
  messages,
  pieces,
  gmailConnected,
  estAdmin,
}: {
  prospectId: string;
  prospectEmail: string | null;
  variables: Record<string, string>;
  templates: TemplateLite[];
  messages: EmailMessage[];
  pieces: PieceLite[];
  gmailConnected: boolean;
  estAdmin: boolean;
}) {
  const [templateId, setTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [inReplyTo, setInReplyTo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const piecesTri = useMemo(() => [...pieces].sort((a, b) => a.file_name.localeCompare(b.file_name, "fr")), [pieces]);
  const uploadSize = useMemo(() => uploadFiles.reduce((sum, file) => sum + file.size, 0), [uploadFiles]);

  async function synchroniser(silencieux = false) {
    if (!gmailConnected || !prospectEmail || syncing) return;
    if (!silencieux) setSyncing(true);
    try {
      const response = await fetch(`/api/gmail/prospects/${prospectId}/sync`, { method: "POST" });
      const data = await response.json() as { ok?: boolean; newCount?: number; error?: string };
      if (!response.ok) throw new Error(data.error || "Synchronisation impossible.");
      if ((data.newCount || 0) > 0) {
        window.location.reload();
        return;
      }
      if (!silencieux) setStatus({ ok: true, text: "Emails à jour." });
    } catch (error) {
      if (!silencieux) setStatus({ ok: false, text: error instanceof Error ? error.message : "Synchronisation impossible." });
    } finally {
      if (!silencieux) setSyncing(false);
    }
  }

  useEffect(() => {
    if (!gmailConnected || !prospectEmail) return;
    const key = `capella-gmail-sync-${prospectId}`;
    const last = Number(sessionStorage.getItem(key) || 0);
    if (Date.now() - last < 60_000) return;
    sessionStorage.setItem(key, String(Date.now()));
    void synchroniser(true);
    // Synchronisation volontairement limitée à une fois par minute et par fiche.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gmailConnected, prospectEmail, prospectId]);

  function choisirTemplate(id: string) {
    setTemplateId(id);
    setThreadId(null);
    setInReplyTo(null);
    const template = templates.find((t) => t.id === id);
    if (!template) return;
    setSubject(injecterBalises(template.subject, variables));
    setBody(injecterBalises(template.body, variables));
  }

  function repondre(message: EmailMessage) {
    setTemplateId("");
    setThreadId(message.gmail_thread_id || null);
    setInReplyTo(message.header_message_id || null);
    const current = message.subject || "";
    setSubject(/^re:/i.test(current) ? current : `Re: ${current}`);
    setBody("");
    document.getElementById("email-composer")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function togglePiece(id: string) {
    setAttachmentIds((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  }

  function retirerUpload(index: number) {
    setUploadFiles((current) => current.filter((_, i) => i !== index));
  }

  async function envoyer() {
    if (!prospectEmail || !gmailConnected || sending) return;
    setSending(true);
    setStatus(null);
    try {
      const form = new FormData();
      form.set("subject", subject);
      form.set("body", body);
      form.set("cc", cc);
      form.set("bcc", bcc);
      form.set("templateId", templateId);
      form.set("attachmentIds", JSON.stringify(attachmentIds));
      form.set("threadId", threadId || "");
      form.set("inReplyTo", inReplyTo || "");
      uploadFiles.forEach((file) => form.append("files", file, file.name));

      const response = await fetch(`/api/gmail/prospects/${prospectId}/send`, {
        method: "POST",
        body: form,
      });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok) throw new Error(data.error || "Envoi impossible.");
      setStatus({ ok: true, text: "Email envoyé." });
      setBody("");
      setSubject("");
      setCc("");
      setBcc("");
      setTemplateId("");
      setAttachmentIds([]);
      setUploadFiles([]);
      setFileInputKey((value) => value + 1);
      setThreadId(null);
      setInReplyTo(null);
      setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      setStatus({ ok: false, text: error instanceof Error ? error.message : "Envoi impossible." });
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="rounded-xl border border-navy-100 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy-100 px-5 py-4">
        <div>
          <h2 className="font-semibold text-navy-800">Emails</h2>
          <p className="text-xs text-grey-brand">Envoi, réponses et historique Gmail rattachés à cette fiche.</p>
        </div>
        {gmailConnected && prospectEmail ? (
          <button type="button" onClick={() => void synchroniser(false)} disabled={syncing} className="h-9 rounded-lg border border-navy-200 px-3 text-xs font-semibold text-navy-700 hover:bg-navy-50 disabled:opacity-50">
            {syncing ? "Synchronisation…" : "Actualiser les emails"}
          </button>
        ) : null}
      </div>

      {!prospectEmail ? (
        <p className="p-5 text-sm text-grey-brand">Ajoute une adresse email à cette fiche pour utiliser la messagerie.</p>
      ) : !gmailConnected ? (
        <div className="p-5 text-sm text-grey-brand">
          Aucune boîte Gmail n’est connectée au CRM. {estAdmin ? <a href="/admin/emails" className="font-semibold text-navy-700 underline underline-offset-2">Configurer Gmail</a> : "Demande à l’administrateur de connecter la boîte d’envoi."}
        </div>
      ) : (
        <>
          <div id="email-composer" className="border-b border-navy-100 p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-navy-800">Nouveau message</div>
              {threadId ? <button type="button" onClick={() => { setThreadId(null); setInReplyTo(null); setSubject(""); setBody(""); }} className="text-xs text-grey-brand underline">Annuler la réponse</button> : null}
            </div>
            <div className="grid gap-3">
              <div className="grid gap-3 md:grid-cols-[240px_1fr]">
                <select value={templateId} onChange={(e) => choisirTemplate(e.target.value)} className="h-10 rounded-lg border border-navy-200 bg-white px-3 text-sm">
                  <option value="">Aucun template</option>
                  {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
                </select>
                <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Objet du mail" className="h-10 rounded-lg border border-navy-200 px-3 text-sm" />
              </div>

              <div className="rounded-lg border border-navy-100 bg-navy-50/30 p-3">
                <div className="mb-2 text-xs text-grey-brand">À : <strong className="text-navy-700">{prospectEmail}</strong></div>
                <div className="grid gap-2 md:grid-cols-2">
                  <input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="CC — une ou plusieurs adresses" className="h-9 rounded-lg border border-navy-200 bg-white px-3 text-sm" />
                  <input value={bcc} onChange={(e) => setBcc(e.target.value)} placeholder="CCI — une ou plusieurs adresses" className="h-9 rounded-lg border border-navy-200 bg-white px-3 text-sm" />
                </div>
                <div className="mt-2 text-[11px] text-grey-brand">Sépare plusieurs adresses par une virgule ou un point-virgule.</div>
              </div>

              <div className="text-xs text-grey-brand">Le template est entièrement modifiable avant envoi.</div>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={9} placeholder="Écris ton message…" className="rounded-lg border border-navy-200 px-3 py-2 text-sm leading-6" />

              {piecesTri.length ? (
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-grey-brand">Documents de la fiche à joindre</div>
                  <div className="flex flex-wrap gap-2">
                    {piecesTri.map((piece) => (
                      <label key={piece.id} className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-navy-100 px-3 py-2 text-xs text-navy-700 hover:bg-navy-50">
                        <input type="checkbox" checked={attachmentIds.includes(piece.id)} onChange={() => togglePiece(piece.id)} />
                        <span className="max-w-[280px] truncate">{piece.file_name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}

              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-grey-brand">Ajouter une pièce jointe</div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-navy-200 bg-white px-3 text-xs font-semibold text-navy-700 hover:bg-navy-50">
                    Choisir des fichiers
                    <input
                      key={fileInputKey}
                      type="file"
                      multiple
                      className="sr-only"
                      onChange={(e) => setUploadFiles(Array.from(e.currentTarget.files || []))}
                    />
                  </label>
                  <span className="text-xs text-grey-brand">18 Mo maximum au total · {uploadFiles.length ? `${uploadFiles.length} fichier${uploadFiles.length > 1 ? "s" : ""}, ${poidsFichier(uploadSize)}` : "aucun fichier sélectionné"}</span>
                </div>
                {uploadFiles.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {uploadFiles.map((file, index) => (
                      <span key={`${file.name}-${index}`} className="inline-flex max-w-full items-center gap-2 rounded-lg bg-navy-50 px-3 py-1.5 text-xs text-navy-700">
                        <span className="max-w-[280px] truncate">{file.name}</span>
                        <span className="text-grey-brand">{poidsFichier(file.size)}</span>
                        <button type="button" onClick={() => retirerUpload(index)} className="font-bold text-grey-brand hover:text-star-600" aria-label={`Retirer ${file.name}`}>×</button>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => void envoyer()} disabled={sending || !subject.trim() || !body.trim() || uploadSize > 18 * 1024 * 1024} className="h-10 rounded-lg bg-star-500 px-5 text-sm font-semibold text-white hover:bg-star-600 disabled:opacity-50">
                  {sending ? "Envoi…" : threadId ? "Envoyer la réponse" : "Envoyer l’email"}
                </button>
                {uploadSize > 18 * 1024 * 1024 ? <span className="text-sm text-red-700">Les fichiers sélectionnés dépassent 18 Mo.</span> : null}
                {status ? <span className={`text-sm ${status.ok ? "text-green-700" : "text-red-700"}`}>{status.text}</span> : null}
              </div>
            </div>
          </div>

          <div className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-navy-800">Historique des échanges</h3>
              <span className="text-xs text-grey-brand">{messages.length} message{messages.length > 1 ? "s" : ""}</span>
            </div>
            {!messages.length ? (
              <p className="text-sm text-grey-brand">Aucun échange trouvé avec {prospectEmail}. La synchronisation Gmail recherche aussi les emails antérieurs à la création de la fiche.</p>
            ) : (
              <div className="space-y-3">
                {messages.map((message) => (
                  <article key={message.id} className={`rounded-xl border p-4 ${message.direction === "incoming" ? "border-star-200 bg-star-50/30" : "border-navy-100 bg-navy-50/30"}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${message.direction === "incoming" ? "bg-star-100 text-star-800" : "bg-navy-100 text-navy-700"}`}>
                            {message.direction === "incoming" ? "Reçu" : "Envoyé"}
                          </span>
                          <strong className="text-sm text-navy-800">{message.subject || "Sans objet"}</strong>
                        </div>
                        <div className="mt-1 text-xs text-grey-brand">
                          {message.direction === "incoming" ? `De ${message.from_email || "client"}` : `À ${message.to_emails.join(", ") || prospectEmail}`} · {dateEmail(message.sent_at)}
                          {message.cc_emails.length ? ` · CC : ${message.cc_emails.join(", ")}` : ""}
                        </div>
                      </div>
                      <button type="button" onClick={() => repondre(message)} className="text-xs font-semibold text-navy-700 underline underline-offset-2">Répondre</button>
                    </div>
                    <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-navy-800">{message.body_text || message.snippet || "(contenu non disponible)"}</div>
                    {Array.isArray(message.attachments) && message.attachments.length ? (
                      <div className="mt-3 text-xs text-grey-brand">Pièces jointes : {message.attachments.map((a) => a.filename).filter(Boolean).join(", ")}</div>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
