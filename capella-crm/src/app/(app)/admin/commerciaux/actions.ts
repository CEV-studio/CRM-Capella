"use server";
import { hasPermission, readPermissions } from "@/lib/permissions";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireManage } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "@/lib/action-result";

/**
 * Toutes ces actions utilisent la clé de service, qui ignore RLS.
 * Chacune commence donc OBLIGATOIREMENT par requireManage() : seul un
 * admin ou un délégué « gérer l'équipe » peut les exécuter.
 */

/**
 * Mot de passe provisoire lisible à voix haute et sans ambiguïté :
 * ni O/0, ni I/l/1. Format « Capella-XXXX-XXXX ».
 */
function genererMotDePasse(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bloc = () =>
    Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join("");
  return `Capella-${bloc()}-${bloc()}`;
}

export async function creerCommercial(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireManage();
  let permissions:ReturnType<typeof readPermissions>;
  try{permissions=readPermissions(formData);}catch{return {ok:false,message:'Permission inconnue.'};}
  if(!hasPermission(actor,'administration')&&permissions.some(p=>!['crm','email'].includes(p)))return {ok:false,message:'Permission d’administration requise.'};

  const nom = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const tauxBrut = String(formData.get("commission_rate") ?? "").replace(",", ".");
  const taux = Number(tauxBrut);

  if (!nom) return { ok: false, message: "Le nom est obligatoire." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return { ok: false, message: "L'adresse email n'est pas valide." };
  if (!Number.isFinite(taux) || taux < 0 || taux > 100)
    return { ok: false, message: "Le taux doit être un nombre entre 0 et 100." };

  const admin = createAdminClient();
  const motDePasse = genererMotDePasse();

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: motDePasse,
    email_confirm: true, // pas d'email de confirmation : Jeremy transmet lui-même
    user_metadata: {
      full_name: nom,
      commission_rate: permissions.some(p=>['crm','apporteur'].includes(p)) ? taux / 100 : 0,
      must_change_password: true,
    },
  });

  if (error) {
    const dejaPris =
      error.message.toLowerCase().includes("already") ||
      error.message.toLowerCase().includes("registered");
    return {
      ok: false,
      message: dejaPris
        ? `Un compte existe déjà avec l'adresse ${email}.`
        : `Création impossible : ${error.message}`,
    };
  }

  if(created.user){
    const {error:permissionError}=await admin.from('profiles').update({permissions,commission_rate:permissions.some(p=>['crm','apporteur'].includes(p))?taux/100:0}).eq('id',created.user.id);
    if(permissionError){await admin.auth.admin.deleteUser(created.user.id);return {ok:false,message:`Création annulée : ${permissionError.message}`};}
  }
  revalidatePath("/admin/commerciaux");
  return {
    ok: true,
    message: `Compte créé pour ${nom}.`,
    motDePasse,
  };
}

export async function reinitialiserMotDePasse(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, message: "Commercial introuvable." };

  const admin = createAdminClient();

  const motDePasse = genererMotDePasse();

  const { error } = await admin.auth.admin.updateUserById(id, {
    password: motDePasse,
  });
  if (error) return { ok: false, message: `Échec : ${error.message}` };

  // Il devra le changer dès sa prochaine connexion.
  const { error: errProfil } = await admin
    .from("profiles")
    .update({ must_change_password: true })
    .eq("id", id);
  if (errProfil) return { ok: false, message: `Échec : ${errProfil.message}` };

  revalidatePath("/admin/commerciaux");
  return {
    ok: true,
    message: "Nouveau mot de passe provisoire généré.",
    motDePasse,
  };
}

export async function basculerActivation(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const moi = await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const actifDemande = String(formData.get("actif")) === "true";

  if (id === moi.id) {
    return { ok: false, message: "Tu ne peux pas désactiver ton propre compte." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ is_active: actifDemande })
    .eq("id", id);

  if (error) return { ok: false, message: `Échec : ${error.message}` };

  revalidatePath("/admin/commerciaux");
  return {
    ok: true,
    message: actifDemande
      ? "Compte réactivé."
      : "Compte désactivé : cette personne ne voit plus aucune donnée.",
  };
}

export async function modifierTaux(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const taux = Number(String(formData.get("commission_rate") ?? "").replace(",", "."));

  if (!Number.isFinite(taux) || taux < 0 || taux > 100)
    return { ok: false, message: "Le taux doit être un nombre entre 0 et 100." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ commission_rate: taux / 100 })
    .eq("id", id);

  if (error) return { ok: false, message: `Échec : ${error.message}` };

  revalidatePath("/admin/commerciaux");
  return { ok: true, message: `Taux mis à jour : ${taux} %.` };
}

/** Only the administration permission can grant or revoke access. */
export async function modifierPermissions(_prev:ActionResult|null,formData:FormData):Promise<ActionResult>{
 await requireAdmin();
 const id=String(formData.get('id')??'');
 let permissions:ReturnType<typeof readPermissions>;
 try{permissions=readPermissions(formData);}catch{return {ok:false,message:'Permission inconnue.'};}
 const db=await import('@/lib/supabase/server').then(m=>m.createClient());
 const {error}=await db.rpc('set_profile_permissions',{p_id:id,p_permissions:permissions});
 revalidatePath('/admin/commerciaux');revalidatePath('/','layout');
 return {ok:!error,message:error?.message??'Permissions enregistrées.'};
}

export async function affecterEquipe(_prev:ActionResult|null,formData:FormData):Promise<ActionResult>{
 await requireAdmin();
 const id=String(formData.get('id')??'');const teamId=String(formData.get('partner_team_id')??'');
 const db=createAdminClient();
 if(!id)return {ok:false,message:'Affectation invalide.'};
 if(teamId){const {data:team,error}=await db.from('partner_teams').select('id').eq('id',teamId).eq('is_active',true).maybeSingle();if(error||!team)return {ok:false,message:'Équipe active introuvable.'};}
 const {data,error}=await db.from('profiles').update({partner_team_id:teamId||null,manager_id:null}).eq('id',id).contains('permissions',['crm']).is('archived_at',null).select('id').maybeSingle();
 if(error||!data)return {ok:false,message:error?.message??'Commercial introuvable.'};
 revalidatePath('/admin/commerciaux');revalidatePath('/admin/equipes');revalidatePath('/equipe');return {ok:true,message:'Équipe attribuée.'};
}
