import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

function safeReturnTo(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/agenda";
  return value;
}

export async function POST(request: Request) {
  const profile = await requireProfile();
  const form = await request.formData();
  const returnTo = safeReturnTo(String(form.get("returnTo") || "/agenda"));
  const admin = createAdminClient();
  await admin.from("calendar_accounts").update({ is_active: false }).eq("profile_id", profile.id);
  const url = new URL(returnTo, new URL(request.url).origin);
  url.searchParams.set("calendar", "deconnecte");
  return NextResponse.redirect(url, 303);
}
