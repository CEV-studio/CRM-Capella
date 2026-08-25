import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("email_accounts").delete().eq("is_active", true);
  const origin = new URL(request.url).origin;
  const url = new URL("/admin/emails", origin);
  url.searchParams.set("gmail", error ? "erreur" : "deconnecte");
  if (error) url.searchParams.set("message", error.message);
  return NextResponse.redirect(url, { status: 303 });
}
