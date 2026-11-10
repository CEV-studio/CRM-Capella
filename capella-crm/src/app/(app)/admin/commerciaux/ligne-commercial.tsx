"use client";

import { useActionState, useRef, useState } from "react";
import {
  modifierRole,
  affecterEquipe,
  basculerActivation,
  modifierPermissions,
  modifierTaux,
  reinitialiserMotDePasse,
} from "./actions";
import type { ActionResult } from "@/lib/action-result";
import { Button, Input } from "@/components/ui";
import type { Profile } from "@/lib/domain/database.types";
import { ChevronDown, Users } from "lucide-react";
import { ProfilCorbeilleButton } from "@/components/profil-corbeille-button";

export function LigneCommercial({
  profil,
  estMoi,
  equipes,
  estAdmin,
}: {
  profil: Profile;
  estMoi: boolean;
  equipes: {id:string;name:string}[];
  estAdmin: boolean;
}) {
  const [etatManager,actionManager]=useActionState<ActionResult|null,FormData>(affecterEquipe,null);
  const [etatRole,actionRole]=useActionState<ActionResult|null,FormData>(modifierRole,null);
  const [etatTaux, actionTaux, tauxEnCours] = useActionState<ActionResult | null, FormData>(
    modifierTaux,
    null,
  );
  const [etatActif, actionActif, actifEnCours] = useActionState<ActionResult | null, FormData>(
    basculerActivation,
    null,
  );
  const [etatMdp, actionMdp, mdpEnCours] = useActionState<ActionResult | null, FormData>(
    reinitialiserMotDePasse,
    null,
  );
  const [etatPerm, actionPerm] = useActionState<ActionResult | null, FormData>(
    modifierPermissions,
    null,
  );
  const [copie, setCopie] = useState(false);
  const formPerm = useRef<HTMLFormElement>(null);

  const message = etatManager ?? etatRole ?? etatPerm ?? etatMdp ?? etatActif ?? etatTaux;

  // L'admin fondateur a déjà tous les droits : pas de cases pour lui.
  const montrerPermissions = profil.role === "commercial" && profil.is_active;

  return (
    <li className={profil.is_active ? "" : "bg-navy-50/60"}>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-4 transition hover:bg-navy-50/60 [&::-webkit-details-marker]:hidden">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy-50 text-sm font-bold text-navy-700" aria-hidden="true">{profil.full_name.trim().split(/\s+/).slice(0,2).map(part=>part[0]?.toUpperCase()).join("") || <Users size={17}/>}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-navy-900">{profil.full_name}{estMoi && <span className="ml-2 text-xs font-normal text-grey-brand">(vous)</span>}</span>
            <span className="block truncate text-xs text-grey-brand">{profil.email}</span>
            <span className="mt-1 block text-xs text-navy-600 sm:hidden">{profil.role === "qualite" ? "Responsable qualité" : profil.role === "manager" && profil.hierarchy_title === "Leader" ? "Leader" : profil.role === "admin" ? "Administrateur" : profil.role === "manager" ? "Manager" : profil.role === "apporteur" ? "Apporteur" : "Commercial"} · {profil.is_active ? "Actif" : "Désactivé"}</span>
          </span>
          <span className="hidden min-w-0 text-right sm:block">
            <span className="block text-sm font-medium text-navy-800">{profil.role === 'admin' ? 'Administrateur' : profil.role === 'qualite' ? 'Responsable qualité' : profil.role === 'manager' ? profil.hierarchy_title === 'Leader' ? 'Leader' : 'Manager' : profil.role === 'apporteur' ? 'Apporteur' : 'Commercial'}</span>
            {profil.role === 'commercial' && <span className="block max-w-40 truncate text-xs text-grey-brand">{equipes.find(e=>e.id===profil.partner_team_id)?.name || 'Sans équipe'}</span>}
          </span>
          <span className={`hidden shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold sm:inline-flex ${profil.is_active ? 'bg-emerald-50 text-emerald-800' : 'bg-navy-100 text-navy-600'}`}>{profil.is_active ? 'Actif' : 'Désactivé'}</span>
          <span className="shrink-0 text-xs font-semibold text-navy-600">Gérer</span><ChevronDown size={17} className="shrink-0 text-navy-500 transition-transform group-open:rotate-180" aria-hidden="true"/>
        </summary>
        <div className="space-y-5 border-t border-navy-100 bg-[#FAFAF7] px-5 py-5">
          {profil.must_change_password && <p className="text-xs font-medium text-amber-800">Mot de passe à changer à la prochaine connexion</p>}
          <div className="flex flex-wrap items-end gap-3">
            <span className="w-full text-xs font-semibold uppercase tracking-wide text-grey-brand">Profil et affectation</span>
        {profil.role!=="admin"&&estAdmin?<form action={actionRole} className="flex items-center gap-2"><input type="hidden" name="id" value={profil.id}/><select name="role" defaultValue={profil.role === "manager" && profil.hierarchy_title === "Leader" ? "leader" : profil.role} className="rounded border p-2 text-sm"><option value="commercial">Commercial</option><option value="leader">Leader</option><option value="manager">Manager</option><option value="apporteur">Apporteur</option><option value="qualite">Responsable qualité</option></select><Button type="submit" variant="ghost">Changer le rôle</Button></form>:null}
        {estAdmin&&profil.role==='commercial'?<form action={actionManager} className="flex items-center gap-2"><input type="hidden" name="id" value={profil.id}/><label className="text-sm">Équipe <select name="partner_team_id" defaultValue={profil.partner_team_id??''} className="rounded border p-2 text-sm"><option value="">Aucune</option>{equipes.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label><Button type="submit" variant="ghost">Attribuer</Button></form>:null}
          </div>
          {estAdmin && <div className="flex flex-wrap items-end gap-3"><span className="w-full text-xs font-semibold uppercase tracking-wide text-grey-brand">Commission</span><form action={actionTaux} className="flex items-center gap-1.5">
          <input type="hidden" name="id" value={profil.id} />
          <Input
            name="commission_rate"
            type="number"
            min={0}
            max={100}
            step="1"
            defaultValue={Math.round(profil.commission_rate * 100)}
            className="h-9 w-20 text-sm"
            aria-label={`Taux de commission de ${profil.full_name}`}
          />
          <span className="text-sm text-grey-brand">%</span>
          <Button type="submit" variant="ghost" className="h-9" disabled={tauxEnCours}>
            {tauxEnCours ? "…" : "Enregistrer"}
          </Button>
        </form></div>}

        <div className="flex flex-wrap items-center gap-3"><span className="w-full text-xs font-semibold uppercase tracking-wide text-grey-brand">Accès au compte</span>
        <form action={actionMdp}>
          <input type="hidden" name="id" value={profil.id} />
          <Button type="submit" variant="ghost" className="h-9" disabled={mdpEnCours}>
            {mdpEnCours ? "…" : "Réinitialiser le mot de passe"}
          </Button>
        </form>

        {estMoi ? (
          <span className="text-xs text-grey-brand">(c&apos;est toi)</span>
        ) : (
          <form action={actionActif}>
            <input type="hidden" name="id" value={profil.id} />
            <input type="hidden" name="actif" value={String(!profil.is_active)} />
            <Button
              type="submit"
              variant={profil.is_active ? "ghost" : "secondary"}
              className="h-9"
              disabled={actifEnCours}
            >
              {actifEnCours ? "…" : profil.is_active ? "Désactiver" : "Réactiver"}
            </Button>
          </form>
        )}
        {estAdmin && profil.role !== 'admin' && <ProfilCorbeilleButton id={profil.id} nom={profil.full_name} />}
      </div>

      {montrerPermissions ? (
        <form
          ref={formPerm}
          action={actionPerm}
          className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-navy-100 pt-4"
        >
          <input type="hidden" name="id" value={profil.id} />
          <span className="text-xs font-semibold uppercase tracking-wide text-grey-brand">
            Permissions
          </span>
          {[
            { name: "can_export", label: "Exporter en CSV", defaut: profil.can_export, alerte: false },
            { name: "can_view_all", label: "Voir tous les leads", defaut: profil.can_view_all, alerte: true },
            { name: "can_manage_team", label: "Gérer l'équipe", defaut: profil.can_manage_team, alerte: true },
          ].map((perm) => (
            <label key={perm.name} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                name={perm.name}
                defaultChecked={perm.defaut}
                onChange={() => formPerm.current?.requestSubmit()}
                className="h-4 w-4 accent-[var(--color-star-500)]"
              />
              <span className={perm.alerte ? "text-navy-800" : "text-navy-700"}>
                {perm.label}
                {perm.alerte ? <span className="ml-0.5 text-star-600" title="Droit sensible">⚠</span> : null}
              </span>
            </label>
          ))}
        </form>
      ) : null}

      {message ? (
        <div className="">
          <div
            className="rounded-lg px-3 py-2 text-sm text-navy-800"
            style={{
              backgroundColor: message.ok
                ? "var(--color-status-signe)"
                : "var(--color-status-perdu)",
            }}
          >
            {message.message}
            {message.ok && "motDePasse" in message && message.motDePasse ? (
              <span className="mt-2 flex flex-wrap items-center gap-2">
                <code className="rounded bg-white px-2 py-1 font-mono text-sm font-bold">
                  {message.motDePasse}
                </code>
                <button
                  type="button"
                  className="text-xs underline underline-offset-2"
                  onClick={async () => {
                    await navigator.clipboard.writeText(message.motDePasse!);
                    setCopie(true);
                    setTimeout(() => setCopie(false), 2000);
                  }}
                >
                  {copie ? "copié ✓" : "copier"}
                </button>
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
        </div>
      </details>
    </li>
  );
}
