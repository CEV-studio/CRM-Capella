import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { decryptRefreshToken } from "@/lib/gmail";

export const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const GOOGLE_EMAIL_SCOPE = "https://www.googleapis.com/auth/userinfo.email";
const CALENDAR_TIME_ZONE = "Europe/Paris";

export type CalendarAccount = {
  id: string;
  profile_id: string;
  email: string;
  refresh_token_enc: string;
  scope: string;
  is_active: boolean;
  connected_at: string;
  updated_at: string;
};

function env(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} manquante dans les variables d’environnement.`);
  return value;
}

function oauthRedirectUri(origin: string): string {
  // Réutilise le callback déjà autorisé pour Gmail afin d'éviter une seconde
  // URI à enregistrer dans Google Cloud.
  return `${origin.replace(/\/$/, "")}/api/gmail/callback`;
}

export function buildCalendarAuthorizationUrl(origin: string, state: string): string {
  const params = new URLSearchParams({
    client_id: env("GOOGLE_GMAIL_CLIENT_ID"),
    redirect_uri: oauthRedirectUri(origin),
    response_type: "code",
    scope: `${GOOGLE_CALENDAR_SCOPE} ${GOOGLE_EMAIL_SCOPE}`,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCalendarCode(origin: string, code: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env("GOOGLE_GMAIL_CLIENT_ID"),
      client_secret: env("GOOGLE_GMAIL_CLIENT_SECRET"),
      redirect_uri: oauthRedirectUri(origin),
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  const json = await response.json() as {
    access_token?: string;
    refresh_token?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || "Connexion Google Calendar impossible.");
  }
  if (!json.refresh_token) {
    throw new Error("Google n’a pas renvoyé de refresh token. Reconnecte l’agenda et accepte les autorisations.");
  }
  return json;
}

export async function getGoogleAccountEmail(accessToken: string): Promise<string> {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const json = await response.json() as { email?: string; error?: { message?: string } };
  if (!response.ok || !json.email) {
    throw new Error(json.error?.message || "Impossible de lire le compte Google connecté.");
  }
  return json.email.toLowerCase();
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: env("GOOGLE_GMAIL_CLIENT_ID"),
      client_secret: env("GOOGLE_GMAIL_CLIENT_SECRET"),
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  const json = await response.json() as { access_token?: string; error?: string; error_description?: string };
  if (!response.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || "Renouvellement de l’accès Google Calendar impossible.");
  }
  return json.access_token;
}

export async function getCalendarAccount(profileId: string): Promise<CalendarAccount | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("calendar_accounts")
    .select("*")
    .eq("profile_id", profileId)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error(`Lecture de Google Calendar impossible : ${error.message}`);
  return data as CalendarAccount | null;
}

async function calendarAccessToken(account: CalendarAccount): Promise<string> {
  return await refreshAccessToken(decryptRefreshToken(account.refresh_token_enc));
}

export async function createGoogleCalendarEvent(account: CalendarAccount, input: {
  prospectId: string;
  kind: "rdv" | "rappel";
  title: string;
  description?: string | null;
  location?: string | null;
  startLocal: string;
  endLocal: string;
  reminderMinutes?: number | null;
  attendeeEmail?: string | null;
}): Promise<{
  id: string;
  htmlLink: string | null;
  status: string;
  startAt: string;
  endAt: string;
}> {
  const accessToken = await calendarAccessToken(account);
  const sendUpdates = input.attendeeEmail ? "all" : "none";
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=${sendUpdates}`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        summary: input.title,
        description: input.description || undefined,
        location: input.location || undefined,
        start: { dateTime: input.startLocal, timeZone: CALENDAR_TIME_ZONE },
        end: { dateTime: input.endLocal, timeZone: CALENDAR_TIME_ZONE },
        attendees: input.attendeeEmail ? [{ email: input.attendeeEmail }] : undefined,
        reminders: input.reminderMinutes && input.reminderMinutes > 0
          ? { useDefault: false, overrides: [{ method: "popup", minutes: input.reminderMinutes }] }
          : { useDefault: false, overrides: [] },
        extendedProperties: {
          private: {
            capellaProspectId: input.prospectId,
            capellaEventKind: input.kind,
          },
        },
      }),
      cache: "no-store",
    },
  );

  const json = await response.json() as {
    id?: string;
    htmlLink?: string;
    status?: string;
    start?: { dateTime?: string };
    end?: { dateTime?: string };
    error?: { message?: string };
  };
  if (!response.ok || !json.id || !json.start?.dateTime || !json.end?.dateTime) {
    throw new Error(json.error?.message || "Création du rendez-vous Google Calendar impossible.");
  }

  return {
    id: json.id,
    htmlLink: json.htmlLink || null,
    status: json.status || "confirmed",
    startAt: json.start.dateTime,
    endAt: json.end.dateTime,
  };
}

export async function deleteGoogleCalendarEvent(account: CalendarAccount, googleEventId: string): Promise<void> {
  const accessToken = await calendarAccessToken(account);
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(googleEventId)}?sendUpdates=all`,
    {
      method: "DELETE",
      headers: { authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    },
  );
  if (response.ok || response.status === 404 || response.status === 410) return;
  const text = await response.text();
  throw new Error(`Suppression Google Calendar impossible (${response.status}) : ${text.slice(0, 300)}`);
}
