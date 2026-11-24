"use server";
import { hasAnyPermission } from '@/lib/permissions';


import { deliverNotifications } from "@/lib/partners/notifications";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/action-result";

export async function enregistrerAdv(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const profil = await requireProfile();
  if (!hasAnyPermission(profil,['administration','adv'])) {
    return { ok: false, message: "Accès réservé au traitement ADV." };
  }

  const id = String(formData.get("id") ?? "");
  const intention = String(formData.get("intention") ?? "");
  const stage = intention === "signer" ? "Signé" : String(formData.get("stage") ?? "");
  const brut = String(formData.get("commission") ?? "").replace(",", ".").trim();
  const commission = brut === "" ? 0 : Number(brut);

  if (!id) return { ok: false, message: "Dossier introuvable." };
  if (stage === "KO") return { ok: false, message: "Le KO est décidé par le commercial depuis son espace." };
  if (!Number.isFinite(commission) || commission < 0) {
    return { ok: false, message: "Commission invalide." };
  }
  if (stage === "Signé" && commission <= 0) {
    return { ok: false, message: "Renseigne la commission globale avant de valider Signé." };
  }

  const patch: Record<string, unknown> = { stage, commission };
  const dateRelance = String(formData.get("date_relance") ?? "").trim();
  if (dateRelance && !/^\d{4}-\d{2}-\d{2}$/.test(dateRelance)) {
    return { ok: false, message: "Date de relance invalide." };
  }
  patch.date_relance = dateRelance || null;
  if (stage === "Signé") {
    patch.date_signature = String(formData.get("date_signature") ?? "").trim()
      || new Date().toISOString().slice(0, 10);
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("adv_save", {
    p_id:id, p_stage:stage, p_commission:commission,
    p_signature:typeof patch.date_signature==="string" ? patch.date_signature : null, p_relance:dateRelance || null,
    p_verification:formData.get("verification_enabled")==="1" ? formData.get("verification_calls")==="on" : null,
  });
  if(error)return {ok:false,message:error.message};
  await deliverNotifications(profil);
  revalidatePath("/partenaires","layout");
  revalidatePath("/");
  revalidatePath("/adv");
  revalidatePath("/conversion");
  revalidatePath(`/conversion/${id}`);
  revalidatePath("/commissions");
  return {
    ok: true,
    message: stage === "Signé" ? "Dossier signé et commissions comptabilisées." : "ADV enregistré — commission visible en attente.",
  };
}
