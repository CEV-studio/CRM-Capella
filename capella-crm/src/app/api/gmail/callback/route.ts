import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptRefreshToken, exchangeGmailCode, getGmailProfile } from "@/lib/gmail";
import { exchangeCalendarCode, getGoogleAccountEmail, GOOGLE_CALENDAR_SCOPE } from "@/lib/calendar";

function safeReturnTo(value: string | undefined, fallback = "/email"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

function redirectWithParams(origin: string, returnTo: string, params: Record<string, string>) {
  const url = new URL(returnTo, origin);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const profile = await requireProfile();
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const store = await cookies();

  // Google Calendar réutilise ce callback OAuth, mais reste isolé par profil.
  const calendarState = store.get("calendar_oauth_state")?.value;
  if (state && calendarState && state === calendarState) {
    const returnTo = safeReturnTo(store.get("calendar_oauth_return")?.value, "/agenda");
    store.delete("calendar_oauth_state");
    store.delete("calendar_oauth_return");

    if (oauthError) return redirectWithParams(origin, returnTo, { calendar: "erreur", message: oauthError });
    if (!code) return redirectWithParams(origin, returnTo, { calendar: "erreur", message: "Code OAuth Google manquant." });

    try {
      const token = await exchangeCalendarCode(origin, code);
      const email = await getGoogleAccountEmail(token.access_token!);
      const admin = createAdminClient();
      const { error } = await admin.from("calendar_accounts").upsert({
        profile_id: profile.id,
        email,
        refresh_token_enc: encryptRefreshToken(token.refresh_token!),
        scope: token.scope || GOOGLE_CALENDAR_SCOPE,
        is_active: true,
        connected_at: new Date().toISOString(),
      }, { onConflict: "profile_id" });
      if (error) throw new Error(error.message);
      return redirectWithParams(origin, returnTo, { calendar: "connecte" });
    } catch (error) {
      return redirectWithParams(origin, returnTo, {
        calendar: "erreur",
        message: error instanceof Error ? error.message : "Connexion Google Calendar impossible.",
      });
    }
  }

  const expectedState = store.get("gmail_oauth_state")?.value;
  const mode = store.get("gmail_oauth_mode")?.value === "shared" ? "shared" : "personal";
  const returnTo = safeReturnTo(
    store.get("gmail_oauth_return")?.value,
    mode === "shared" ? "/admin/boites-email" : "/email",
  );
  store.delete("gmail_oauth_state");
  store.delete("gmail_oauth_mode");
  store.delete("gmail_oauth_return");

  if (mode === "shared" && profile.role !== "admin") {
    return NextResponse.redirect(new URL("/?motif=acces-refuse", origin));
  }
  if (oauthError) return redirectWithParams(origin, returnTo, { gmail: "erreur", message: oauthError });
  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectWithParams(origin, returnTo, { gmail: "erreur", message: "État OAuth invalide ou expiré." });
  }

  try {
    const token = await exchangeGmailCode(origin, code);
    const gmailProfile = await getGmailProfile(token.access_token!);
    const email = gmailProfile.emailAddress.toLowerCase();
    const admin = createAdminClient();
    const { data: existing, error: existingError } = await admin
      .from("email_accounts")
      .select("id, owner_profile_id, is_shared")
      .eq("email", email)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);

    if (existing && existing.owner_profile_id && existing.owner_profile_id !== profile.id) {
      throw new Error("Cette boîte Gmail est déjà rattachée à un autre compte CRM.");
    }
    if (mode === "personal" && existing?.is_shared) {
      throw new Error("Cette adresse est configurée comme boîte partagée dans le CRM.");
    }

    const payload = {
      email,
      display_name: mode === "shared" ? "Capella Energy" : profile.full_name,
      refresh_token_enc: encryptRefreshToken(token.refresh_token!),
      scope: token.scope || "https://www.googleapis.com/auth/gmail.modify",
      is_active: true,
      owner_profile_id: profile.id,
      is_shared: mode === "shared",
      connected_at: new Date().toISOString(),
      created_by: profile.id,
    };

    if (existing?.id) {
      const { error } = await admin.from("email_accounts").update(payload).eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await admin.from("email_accounts").insert(payload);
      if (error) throw new Error(error.message);
    }

    return redirectWithParams(origin, returnTo, { gmail: "connecte" });
  } catch (error) {
    return redirectWithParams(origin, returnTo, {
      gmail: "erreur",
      message: error instanceof Error ? error.message : "Connexion Gmail impossible.",
    });
  }
}
