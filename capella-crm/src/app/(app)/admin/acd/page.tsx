import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fmtDateHeure } from "@/lib/format";
import { ProspectFichePopup } from "@/components/prospect-fiche-popup";
import { AcdRequestStatus } from "@/components/acd-request-status";

export const dynamic="force-dynamic";
type RequestRow={id:string;prospect_id:string;requested_by:string|null;status:string;raison_sociale:string;siren:string;siret:string;signatory_first_name:string;signatory_last_name:string;signatory_email:string;signatory_phone:string;signatory_capacity:string;signatory_role:string;notes:string|null;submitted_at:string};
type MeterRow={id:string;request_id:string;energy_type:string;identifier:string;contract_expiry:string;address:string|null;position:number};

export default async function AcdATraiterPage(){
  await requireAdmin();const supabase=await createClient();const db=supabase as any;
  const [{data:requests,error},{data:meters},{data:profiles},{data:legacy}]=await Promise.all([
    db.from("acd_requests").select("*").order("submitted_at",{ascending:false}),
    db.from("acd_request_meters").select("*").order("position"),
    supabase.from("profiles").select("id, full_name"),
    supabase.from("prospects").select("id, raison_sociale, ref, assigned_to").eq("stage","Demande ACD").is("deleted_at",null),
  ]);
  const rows=(requests??[]) as RequestRow[];const meterRows=(meters??[]) as MeterRow[];const names=new Map((profiles??[]).map(p=>[p.id,p.full_name]));const requestedProspects=new Set(rows.map(r=>r.prospect_id));const incomplete=(legacy??[]).filter(p=>!requestedProspects.has(p.id));
  return <main className="mx-auto w-full max-w-7xl px-6 py-8">
    <h1 className="font-display text-2xl font-bold text-navy-800">Demandes d&apos;ACD</h1><p className="mt-1 text-sm text-grey-brand">Informations transmises par les agents pour créer l&apos;ACD dans Volto et l&apos;envoyer depuis YouSign.</p>
    {error?<div className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">Impossible de charger les demandes : {error.message}</div>:null}
    {incomplete.length?<section className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4"><h2 className="text-sm font-bold text-amber-900">Anciennes demandes à compléter</h2><p className="mt-1 text-xs text-amber-800">Ces fiches étaient déjà à l&apos;étape Demande ACD avant le nouveau formulaire.</p><div className="mt-3 flex flex-wrap gap-2">{incomplete.map(p=><ProspectFichePopup key={p.id} prospectId={p.id} prospectLabel={p.raison_sociale||p.ref||"Prospect"} className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900">{p.raison_sociale||p.ref||"Prospect"} · {p.assigned_to?names.get(p.assigned_to)||"Commercial inconnu":"Sans attribution"}</ProspectFichePopup>)}</div></section>:null}
    <div className="mt-6 space-y-4">{rows.length===0?<div className="rounded-xl border border-navy-100 bg-white p-5 text-sm text-grey-brand">Aucune nouvelle demande à traiter.</div>:rows.map(row=>{const requestMeters=meterRows.filter(m=>m.request_id===row.id);return <article key={row.id} className={`rounded-2xl border bg-white p-5 shadow-[var(--crm-shadow-sm)] ${["terminee","annulee"].includes(row.status)?"border-navy-100 opacity-75":"border-star-200"}`}>
      <div className="flex flex-wrap items-start justify-between gap-4"><div><ProspectFichePopup prospectId={row.prospect_id} prospectLabel={row.raison_sociale} className="font-display text-lg font-bold text-navy-900 hover:text-sky-capella-700">{row.raison_sociale}</ProspectFichePopup><div className="mt-1 text-xs text-grey-brand">Demandée par {row.requested_by?names.get(row.requested_by)||"Commercial inconnu":"Compte supprimé"} · {fmtDateHeure(row.submitted_at)}</div></div><AcdRequestStatus requestId={row.id} initial={row.status}/></div>
      <div className="mt-4 grid gap-4 md:grid-cols-2"><div className="rounded-xl bg-navy-50/60 p-4"><h3 className="text-xs font-bold uppercase tracking-wide text-navy-500">Entreprise</h3><dl className="mt-2 grid grid-cols-[100px_1fr] gap-x-3 gap-y-1.5 text-sm"><dt className="text-grey-brand">SIREN</dt><dd className="font-semibold text-navy-900">{row.siren}</dd><dt className="text-grey-brand">SIRET</dt><dd className="font-semibold text-navy-900">{row.siret}</dd></dl></div><div className="rounded-xl bg-navy-50/60 p-4"><h3 className="text-xs font-bold uppercase tracking-wide text-navy-500">Signataire</h3><div className="mt-2 text-sm font-semibold text-navy-900">{row.signatory_first_name} {row.signatory_last_name}</div><div className="text-xs text-grey-brand">{row.signatory_role} · {row.signatory_capacity==="representant_legal"?"Représentant légal":"Mandataire"}</div><div className="mt-1 text-xs text-grey-brand">{row.signatory_email} · {row.signatory_phone}</div></div></div>
      <div className="mt-4 overflow-x-auto rounded-xl border border-navy-100"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-navy-50 text-xs uppercase tracking-wide text-grey-brand"><tr><th className="px-3 py-2.5">Énergie</th><th className="px-3 py-2.5">PDL / PCE</th><th className="px-3 py-2.5">Échéance</th><th className="px-3 py-2.5">Adresse</th></tr></thead><tbody className="divide-y divide-navy-100">{requestMeters.map(m=><tr key={m.id}><td className="px-3 py-3 font-semibold text-navy-800">{m.energy_type==="electricite"?"Électricité":"Gaz"}</td><td className="px-3 py-3 font-mono text-xs text-navy-800">{m.identifier}</td><td className="px-3 py-3 text-navy-800">{new Intl.DateTimeFormat("fr-FR").format(new Date(`${m.contract_expiry}T12:00:00`))}</td><td className="px-3 py-3 text-grey-brand">{m.address||"—"}</td></tr>)}</tbody></table></div>
      {row.notes?<div className="mt-4 rounded-xl border border-star-200 bg-star-50 px-4 py-3 text-sm text-navy-800"><span className="font-bold">Note : </span>{row.notes}</div>:null}
    </article>})}</div>
  </main>
}
