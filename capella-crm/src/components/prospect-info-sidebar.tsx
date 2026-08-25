import Link from "next/link";
import type { Prospect } from "@/lib/domain/database.types";

function valeur(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-3 border-b border-navy-50 py-2.5 last:border-0">
      <dt className="text-xs leading-5 text-grey-brand">{label}</dt>
      <dd className="min-w-0 break-words text-right text-xs font-medium leading-5 text-navy-800">{children}</dd>
    </div>
  );
}

function Panel({ title, children, open = true }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group rounded-xl border border-navy-100 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-navy-800 marker:hidden">
        <span>{title}</span>
        <span className="text-xs text-grey-brand transition-transform group-open:rotate-180">⌄</span>
      </summary>
      <div className="border-t border-navy-100 px-4 py-1">
        {children}
      </div>
    </details>
  );
}

export function ProspectInfoSidebar({
  prospect,
  ownerName,
  sourceName,
  champsPerso,
}: {
  prospect: Prospect;
  ownerName: string | null;
  sourceName: string | null;
  champsPerso: Array<{ cle: string; libelle: string }>;
}) {
  const p = prospect;
  const champs = champsPerso
    .map((c) => ({ ...c, value: p.champs_perso?.[c.cle] }))
    .filter((c) => c.value);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 px-1">
        <div>
          <h2 className="text-sm font-semibold text-navy-800">Informations</h2>
          <p className="text-[11px] text-grey-brand">Données de la fiche client</p>
        </div>
        <Link href={`/prospection/${p.id}/modifier`} className="rounded-lg border border-navy-200 bg-white px-3 py-1.5 text-xs font-semibold text-navy-700 hover:bg-navy-50">
          Modifier
        </Link>
      </div>

      <Panel title="Suivi commercial">
        <dl>
          <InfoRow label="Étape">{valeur(p.stage)}</InfoRow>
          <InfoRow label="Prochaine action">{valeur(p.next_action)}</InfoRow>
          <InfoRow label="Date de relance">{valeur(p.next_action_date)}</InfoRow>
          <InfoRow label="Score">{p.score === null ? "—" : `${p.score}/5`}</InfoRow>
          <InfoRow label="Commercial">{valeur(ownerName)}</InfoRow>
          <InfoRow label="Source">{valeur(sourceName)}</InfoRow>
        </dl>
      </Panel>

      <Panel title="Contact">
        <dl>
          <InfoRow label="Prénom">{valeur(p.prenom)}</InfoRow>
          <InfoRow label="Nom">{valeur(p.nom)}</InfoRow>
          <InfoRow label="Email">
            {p.mail ? <a className="text-navy-700 underline underline-offset-2" href={`mailto:${p.mail}`}>{p.mail}</a> : "—"}
          </InfoRow>
          <InfoRow label="Mobile">
            {p.tel_mobile ? <a className="text-navy-700 underline underline-offset-2" href={`tel:${p.tel_mobile}`}>{p.tel_mobile}</a> : "—"}
          </InfoRow>
          <InfoRow label="Fixe">
            {p.tel_fixe ? <a className="text-navy-700 underline underline-offset-2" href={`tel:${p.tel_fixe}`}>{p.tel_fixe}</a> : "—"}
          </InfoRow>
        </dl>
      </Panel>

      <Panel title="Énergie & contrat">
        <dl>
          <InfoRow label="Fournisseur élec">{valeur(p.fournisseur_electricite)}</InfoRow>
          <InfoRow label="Fournisseur gaz">{valeur(p.fournisseur_gaz)}</InfoRow>
          <InfoRow label="PDL">{valeur(p.pdl)}</InfoRow>
          <InfoRow label="PCE">{valeur(p.pce)}</InfoRow>
          <InfoRow label="CAR élec">{p.car_electricite === null ? "—" : `${p.car_electricite} MWh`}</InfoRow>
          <InfoRow label="CAR gaz">{p.car_gaz === null ? "—" : `${p.car_gaz} MWh`}</InfoRow>
          <InfoRow label="Option tarifaire">{valeur(p.option_tarifaire)}</InfoRow>
          <InfoRow label="Fin de contrat">{valeur(p.date_fin_contrat)}</InfoRow>
        </dl>
      </Panel>

      <Panel title="Entreprise" open={false}>
        <dl>
          <InfoRow label="Raison sociale">{valeur(p.raison_sociale)}</InfoRow>
          <InfoRow label="SIREN">{valeur(p.siren)}</InfoRow>
          <InfoRow label="NAF">{valeur(p.naf)}</InfoRow>
          <InfoRow label="Code postal">{valeur(p.code_postal)}</InfoRow>
          <InfoRow label="Segment">{valeur(p.segment)}</InfoRow>
          <InfoRow label="Nombre de sites">{valeur(p.nb_sites)}</InfoRow>
        </dl>
      </Panel>

      {champs.length ? (
        <Panel title="Informations personnalisées" open={false}>
          <dl>
            {champs.map((c) => <InfoRow key={c.cle} label={c.libelle}>{valeur(c.value)}</InfoRow>)}
          </dl>
        </Panel>
      ) : null}

      <Panel title="Notes" open={false}>
        <div className="whitespace-pre-wrap py-3 text-xs leading-5 text-navy-800">{p.notes || "Aucune note."}</div>
      </Panel>
    </div>
  );
}
