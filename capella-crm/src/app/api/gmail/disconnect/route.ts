import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

function safeReturnTo(value: FormDataEntryValue | null): string {
  const raw = typeof value === "string" ? value : "";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/email";
  return raw;
}

export async function POST(request: Request) {
  const profile = await requireProfile();
  const form = await request.formData();
  let accountId = String(form.get("account_id") || "").trim();
  const returnTo = safeReturnTo(form.get("return_to"));
  const origin = new URL(request.url).origin;
  const url = new URL(returnTo, origin);
  const admin = createAdminClient();

  // Compatibilité avec l'ancien bouton admin qui ne transmettait pas encore l'id.
  if (!accountId) {
    const { data: ownAccount } = await admin
      .from("email_accounts")
      .select("id")
      .eq("owner_profile_id", profile.id)
      .eq("is_active", true)
      .order("connected_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    accountId = ownAccount?.id || "";
  }

  if (!accountId) {
    url.searchParams.set("gmail", "erreur");
    url.searchParams.set("message", "Boîte Gmail non précisée.");
    return NextResponse.redirect(url, { status: 303 });
  }

  const { data: account, error: readError } = await admin
    .from("email_accounts")
    .select("id, owner_profile_id, is_shared")
    .eq("id", accountId)
    .maybeSingle();

  if (readError || !account) {
    url.searchParams.set("gmail", "erreur");
    url.searchParams.set("message", readError?.message || "Boîte Gmail introuvable.");
    return NextResponse.redirect(url, { status: 303 });
  }

  const allowed = account.owner_profile_id === profile.id || profile.role === "admin";
  if (!allowed) {
    url.searchParams.set("gmail", "erreur");
    url.searchParams.set("message", "Tu n’as pas le droit de déconnecter cette boîte Gmail.");
    return NextResponse.redirect(url, { status: 303 });
  }

  const { error } = await admin.from("email_accounts").update({ is_active: false }).eq("id", accountId);
  url.searchParams.set("gmail", error ? "erreur" : "deconnecte");
  if (error) url.searchParams.set("message", error.message);
  return NextResponse.redirect(url, { status: 303 });
}
