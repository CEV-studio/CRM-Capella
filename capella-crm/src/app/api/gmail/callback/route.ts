import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptRefreshToken, exchangeGmailCode, getGmailProfile } from "@/lib/gmail";
import { exchangeCalendarCode, getGoogleAccountEmail, GOOGLE_CALENDAR_SCOPE } from "@/lib/calendar";

function redirectAdmin(origin: string, params: Record<string, string>) {
  const url = new URL("/admin/emails", origin);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return NextResponse.redirect(url);
}

function safeReturnTo(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/agenda";
  return value;
}

function redirectCalendar(origin: string, returnTo: string, params: Record<string, string>) {
  const url = new URL(safeReturnTo(returnTo), origin);
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

  // Google Calendar réutilise volontairement ce callback, déjà déclaré dans
  // Google Cloud pour Gmail. Cela évite une nouvelle URI OAuth à configurer.
  const calendarState = store.get("calendar_oauth_state")?.value;
  if (state && calendarState && state === calendarState) {
    const returnTo = safeReturnTo(store.get("calendar_oauth_return")?.value);
    store.delete("calendar_oauth_state");
    store.delete("calendar_oauth_return");

    if (oauthError) return redirectCalendar(origin, returnTo, { calendar: "erreur", message: oauthError });
    if (!code) return redirectCalendar(origin, returnTo, { calendar: "erreur", message: "Code OAuth Google manquant." });

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
      return redirectCalendar(origin, returnTo, { calendar: "connecte" });
    } catch (error) {
      return redirectCalendar(origin, returnTo, {
        calendar: "erreur",
        message: error instanceof Error ? error.message : "Connexion Google Calendar impossible.",
      });
    }
  }

  // Flux Gmail historique : toujours strictement réservé à l'administrateur.
  if (profile.role !== "admin") {
    return NextResponse.redirect(new URL("/?motif=acces-refuse", origin));
  }

  const expectedState = store.get("gmail_oauth_state")?.value;
  if (state && expectedState && state === expectedState) store.delete("gmail_oauth_state");

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
