"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function text(formData: FormData, name: string): string {
  return String(formData.get(name) || "").trim();
}

export async function attribuerBoitePartagee(formData: FormData) {
  await requireAdmin();
  const accountId = text(formData, "account_id");
  const profileId = text(formData, "profile_id");
  const isDefault = formData.get("is_default") === "on";
  if (!accountId || !profileId) return;

  const supabase = await createClient();
  const { data: account } = await supabase
    .from("email_accounts")
    .select("id")
    .eq("id", accountId)
    .eq("is_shared", true)
    .maybeSingle();
  if (!account) return;

  if (isDefault) {
    await supabase.from("email_account_members").update({ is_default: false }).eq("profile_id", profileId);
  }

  await supabase.from("email_account_members").upsert({
    email_account_id: accountId,
    profile_id: profileId,
    can_read: true,
    can_send: true,
    is_default: isDefault,
  }, { onConflict: "email_account_id,profile_id" });

  revalidatePath("/admin/boites-email");
  revalidatePath("/email");
}

export async function retirerBoitePartagee(formData: FormData) {
  await requireAdmin();
  const accountId = text(formData, "account_id");
  const profileId = text(formData, "profile_id");
  if (!accountId || !profileId) return;

  const supabase = await createClient();
  await supabase
    .from("email_account_members")
    .delete()
    .eq("email_account_id", accountId)
    .eq("profile_id", profileId);

  revalidatePath("/admin/boites-email");
  revalidatePath("/email");
}
