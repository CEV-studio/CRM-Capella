import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createGoogleCalendarEvent, deleteGoogleCalendarEvent, getCalendarAccount } from "@/lib/calendar";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const START_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const DURATIONS = new Set([15, 30, 45, 60, 90, 120]);
const REMINDERS = new Set([0, 10, 30, 60, 1440]);

function addMinutesWallTime(startLocal: string, minutes: number): string {
  const date = new Date(`${startLocal}:00Z`);
  if (Number.isNaN(date.getTime())) throw new Error("Date de rendez-vous invalide.");
  return new Date(date.getTime() + minutes * 60_000).toISOString().slice(0, 19);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await requireProfile();
  const { id } = await params;
  const supabase = await createClient();
  const { data: prospect } = await supabase
    .from("prospects")
    .select("id, raison_sociale, nom, prenom, mail")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!prospect) return NextResponse.json({ error: "Prospect introuvable." }, { status: 404 });

  const account = await getCalendarAccount(profile.id);
  if (!account) {
    return NextResponse.json({ error: "Connecte d’abord ton Google Calendar au CRM." }, { status: 400 });
  }

  const input = await request.json() as {
    kind?: string;
    title?: string;
    startLocal?: string;
    durationMinutes?: number;
    reminderMinutes?: number;
    description?: string;
    location?: string;
    inviteClient?: boolean;
  };

  const kind = input.kind === "rappel" ? "rappel" : "rdv";
  const startLocal = String(input.startLocal || "").trim();
  const durationMinutes = Number(input.durationMinutes || 30);
  const reminderMinutes = Number(input.reminderMinutes ?? 30);
  const contact = [prospect.prenom, prospect.nom].filter(Boolean).join(" ");
  const cible = prospect.raison_sociale || contact || "Prospect";
  const title = String(input.title || "").trim() || `${kind === "rappel" ? "Rappel" : "Rendez-vous"} — ${cible}`;
  const inviteClient = Boolean(input.inviteClient && prospect.mail && EMAIL_RE.test(prospect.mail));

  if (!START_RE.test(startLocal)) {
    return NextResponse.json({ error: "Choisis une date et une heure valides." }, { status: 400 });
  }
  if (!DURATIONS.has(durationMinutes)) {
    return NextResponse.json({ error: "Durée de rendez-vous invalide." }, { status: 400 });
  }
  if (!REMINDERS.has(reminderMinutes)) {
    return NextResponse.json({ error: "Délai de rappel invalide." }, { status: 400 });
  }

  const endLocal = addMinutesWallTime(startLocal, durationMinutes);
  const origin = new URL(request.url).origin;
  const userDescription = String(input.description || "").trim();
  const description = [
    userDescription,
    `Fiche Capella CRM : ${origin}/prospection/${id}`,
  ].filter(Boolean).join("\n\n");

  let googleEventId: string | null = null;
  try {
    const googleEvent = await createGoogleCalendarEvent(account, {
      prospectId: id,
      kind,
      title,
      description,
      location: String(input.location || "").trim() || null,
      startLocal: `${startLocal}:00`,
      endLocal,
      reminderMinutes,
      attendeeEmail: inviteClient ? prospect.mail : null,
    });
    googleEventId = googleEvent.id;

    const admin = createAdminClient();
    const { data: stored, error } = await admin.from("calendar_events").insert({
      prospect_id: id,
      profile_id: profile.id,
      google_event_id: googleEvent.id,
      google_calendar_id: "primary",
      kind,
      title,
      description: userDescription || null,
      location: String(input.location || "").trim() || null,
      start_at: googleEvent.startAt,
      end_at: googleEvent.endAt,
      reminder_minutes: reminderMinutes || null,
      invite_client: inviteClient,
      html_link: googleEvent.htmlLink,
      status: googleEvent.status,
    }).select("*").single();

    if (error || !stored) {
      await deleteGoogleCalendarEvent(account, googleEvent.id).catch(() => undefined);
      throw new Error(error?.message || "Enregistrement du rendez-vous dans le CRM impossible.");
    }

    await supabase.from("prospects").update({ last_action_at: new Date().toISOString() }).eq("id", id);
    return NextResponse.json({ ok: true, event: stored });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Création du rendez-vous impossible.",
      googleEventId,
    }, { status: 500 });
  }
}
