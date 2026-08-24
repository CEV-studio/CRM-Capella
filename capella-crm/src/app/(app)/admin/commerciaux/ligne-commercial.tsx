"use client";

import { useActionState, useRef, useState } from "react";
import {
  basculerActivation,
  modifierPermissions,
  modifierTaux,
  reinitialiserMotDePasse,
} from "./actions";
import type { ActionResult } from "@/lib/action-result";
import { Button, Input } from "@/components/ui";
import type { Profile } from "@/lib/domain/database.types";

export function LigneCommercial({
  profil,
  estMoi,
}: {
  profil: Profile;
  estMoi: boolean;
}) {
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

  const message = etatPerm ?? etatMdp ?? etatActif ?? etatTaux;

  // L'admin fondateur a déjà tous les droits : pas de cases pour lui.
  const montrerPermissions = profil.role !== "admin" && profil.is_active;

  return (
    <li className={profil.is_active ? "" : "bg-navy-50"}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-3">
        <div className="min-w-48 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-navy-800">
              {profil.full_name}
            </span>
            {profil.role === "admin" ? (
              <span className="rounded-full bg-navy-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                Admin
              </span>
            ) : null}
            {!profil.is_active ? (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-navy-800"
                style={{ backgroundColor: "var(--color-status-perdu)" }}
              >
                Désactivé
              </span>
            ) : null}
            {profil.must_change_password ? (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-navy-800"
                style={{ backgroundColor: "var(--color-status-relance)" }}
              >
                Mot de passe à changer
              </span>
            ) : null}
          </div>
          <div className="text-xs text-grey-brand">{profil.email}</div>
        </div>

        <form action={actionTaux} className="flex items-center gap-1.5">
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
        </form>

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
      </div>

      {montrerPermissions ? (
        <form
          ref={formPerm}
          action={actionPerm}
          className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-navy-100 px-5 py-2.5"
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
        <div className="px-5 pb-3">
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
    </li>
  );
}
