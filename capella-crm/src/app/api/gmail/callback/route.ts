import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptRefreshToken, exchangeGmailCode, getGmailProfile } from "@/lib/gmail";

function redirectAdmin(origin: string, params: Record<string, string>) {
  const url = new URL("/admin/emails", origin);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const profile = await requireAdmin();
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const store = await cookies();
  const expectedState = store.get("gmail_oauth_state")?.value;
  store.delete("gmail_oauth_state");

  if (oauthError) return redirectAdmin(origin, { gmail: "erreur", message: oauthError });
  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectAdmin(origin, { gmail: "erreur", message: "État OAuth invalide ou expiré." });
  }

  try {
    const token = await exchangeGmailCode(origin, code);
    const gmailProfile = await getGmailProfile(token.access_token!);
    const admin = createAdminClient();

    await admin.from("email_accounts").update({ is_active: false }).eq("is_active", true);
    const { error } = await admin.from("email_accounts").upsert({
      email: gmailProfile.emailAddress.toLowerCase(),
      display_name: "Capella Energy",
      refresh_token_enc: encryptRefreshToken(token.refresh_token!),
      scope: token.scope || "https://www.googleapis.com/auth/gmail.modify",
      is_active: true,
      connected_at: new Date().toISOString(),
      created_by: profile.id,
    }, { onConflict: "email" });

    if (error) throw new Error(error.message);
    return redirectAdmin(origin, { gmail: "connecte" });
  } catch (error) {
    return redirectAdmin(origin, {
      gmail: "erreur",
      message: error instanceof Error ? error.message : "Connexion Gmail impossible.",
    });
  }
}
