"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function texte(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

export async function creerTemplate(formData: FormData) {
  const profile = await requireAdmin();
  const name = texte(formData, "name");
  if (!name) return;
  const supabase = await createClient();
  await supabase.from("email_templates").insert({
    name,
    subject: texte(formData, "subject"),
    body: String(formData.get("body") ?? ""),
    is_active: true,
    created_by: profile.id,
  });
  revalidatePath("/admin/emails");
}

export async function modifierTemplate(formData: FormData) {
  await requireAdmin();
  const id = texte(formData, "id");
  const name = texte(formData, "name");
  if (!id || !name) return;
  const supabase = await createClient();
  await supabase.from("email_templates").update({
    name,
    subject: texte(formData, "subject"),
    body: String(formData.get("body") ?? ""),
    is_active: formData.get("is_active") === "on",
    sort_order: Number(formData.get("sort_order") ?? 0) || 0,
  }).eq("id", id);
  revalidatePath("/admin/emails");
}

export async function supprimerTemplate(formData: FormData) {
  await requireAdmin();
  const id = texte(formData, "id");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("email_templates").delete().eq("id", id);
  revalidatePath("/admin/emails");
}

export async function enregistrerSignature(formData: FormData) {
  const admin = await requireAdmin();
  const profileIdRaw = texte(formData, "profile_id");
  const profileId = profileIdRaw && profileIdRaw !== "default" ? profileIdRaw : null;
  const html = String(formData.get("html") ?? "").trim();
  const name = texte(formData, "name") || (profileId ? "Signature commerciale" : "Signature par défaut");
  const supabase = await createClient();

  let query = supabase.from("email_signatures").select("id").limit(1);
  query = profileId ? query.eq("profile_id", profileId) : query.is("profile_id", null);
  const { data: existing } = await query.maybeSingle();

  if (existing?.id) {
    await supabase.from("email_signatures").update({
      name,
      html,
      is_active: true,
    }).eq("id", existing.id);
  } else {
    await supabase.from("email_signatures").insert({
      profile_id: profileId,
      name,
      html,
      is_active: true,
      created_by: admin.id,
    });
  }

  revalidatePath("/admin/emails");
}

export async function supprimerSignature(formData: FormData) {
  await requireAdmin();
  const id = texte(formData, "id");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("email_signatures").delete().eq("id", id);
  revalidatePath("/admin/emails");
}
