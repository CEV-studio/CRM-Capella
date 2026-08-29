import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createGoogleCalendarEvent, deleteGoogleCalendarEvent, getCalendarAccount } from "@/lib/calendar";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const START_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const DURATIONS = new Set([15, 30, 45, 60, 90, 120]);
const REMINDERS = new Set([0, 10, 30, 60, 1440]);

function addMinutesWallTime(startLocal: string, minutes: number) {
  const [datePart, timePart] = startLocal.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (Number.isNaN(date.getTime())) throw new Error("Date de rendez-vous invalide.");
  return new Date(date.getTime() + minutes * 60000).toISOString().slice(0, 19);
}

function presentationLabel(startLocal: string) {
  const [datePart, time] = startLocal.split("T");
  const [year, month, day] = datePart.split("-");
  return `${day}/${month}/${year} à ${time}`;
}

function nextActionLabel(kind: "rdv" | "rappel", startAt: string) {
  const formatted = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(startAt)).replace(",", " à");
  return kind === "rdv" ? `Présentation comparatif — ${formatted}` : `Rappel — ${formatted}`;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const profile = await requireProfile();
    const { id } = await params;
    const supabase = await createClient();

    const { data: prospect } = await supabase
      .from("prospects")
      .select("id, raison_sociale, nom, prenom, mail")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!prospect) return NextResponse.json({ error: "Fiche introuvable." }, { status: 404 });

    const account = await getCalendarAccount(profile.id);
    if (!account) return NextResponse.json({ error: "Connecte d’abord ton Google Calendar au CRM." }, { status: 400 });

    const input = await request.json() as {
      kind?: string; title?: string; startLocal?: string; durationMinutes?: number; reminderMinutes?: number;
      description?: string; location?: string; inviteClient?: boolean;
    };

    const kind = input.kind === "rappel" ? "rappel" : "rdv";
    const startLocal = String(input.startLocal || "").trim();
    const durationMinutes = Number(input.durationMinutes || 30);
    const reminderMinutes = Number(input.reminderMinutes ?? 30);
    const contact = [prospect.prenom, prospect.nom].filter(Boolean).join(" ");
    const cible = prospect.raison_sociale || contact || "Client";
    const defaultTitle = kind === "rappel" ? `Rappel — ${cible}` : `Présentation comparatif — ${cible}`;
    const title = String(input.title || "").trim() || defaultTitle;
    const inviteClient = Boolean(input.inviteClient && prospect.mail && EMAIL_RE.test(prospect.mail));

    if (!START_RE.test(startLocal)) return NextResponse.json({ error: "Choisis une date et une heure valides." }, { status: 400 });
    if (!DURATIONS.has(durationMinutes)) return NextResponse.json({ error: "Durée invalide." }, { status: 400 });
    if (!REMINDERS.has(reminderMinutes)) return NextResponse.json({ error: "Rappel invalide." }, { status: 400 });

    const endLocal = addMinutesWallTime(startLocal, durationMinutes);
    const origin = new URL(request.url).origin;
    const userDescription = String(input.description || "").trim();
    const presentation = kind === "rdv" ? `Présentation prévue le ${presentationLabel(startLocal)}` : "";
    const description = [presentation, userDescription, `Fiche Capella CRM : ${origin}/prospection/${id}`].filter(Boolean).join("\n\n");

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
        throw new Error(error?.message || "Enregistrement impossible dans le CRM.");
      }

      const now = new Date().toISOString();
      const [{ data: nextEvent }, { data: nextComparatif }] = await Promise.all([
        supabase.from("calendar_events").select("kind, start_at").eq("prospect_id", id).eq("profile_id", profile.id).gte("end_at", now).order("start_at", { ascending: true }).limit(1).maybeSingle(),
        supabase.from("calendar_events").select("start_at").eq("prospect_id", id).eq("profile_id", profile.id).eq("kind", "rdv").gte("end_at", now).order("start_at", { ascending: true }).limit(1).maybeSingle(),
      ]);

      await supabase.from("prospects").update({
        last_action_at: now,
        next_action: nextEvent ? nextActionLabel(nextEvent.kind as "rdv" | "rappel", nextEvent.start_at) : null,
        next_action_date: nextComparatif?.start_at ? nextComparatif.start_at.slice(0, 10) : null,
      }).eq("id", id);

      return NextResponse.json({ ok: true, event: stored });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Création impossible.", googleEventId }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Création impossible." }, { status: 500 });
  }
}
