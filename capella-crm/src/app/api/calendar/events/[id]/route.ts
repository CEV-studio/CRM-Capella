import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { deleteGoogleCalendarEvent, getCalendarAccount } from "@/lib/calendar";

function nextActionLabel(kind: "rdv" | "rappel", startAt: string): string {
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

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile();
  const { id } = await params;
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("calendar_events")
    .select("id, profile_id, prospect_id, google_event_id")
    .eq("id", id)
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (!event) return NextResponse.json({ error: "Rendez-vous introuvable." }, { status: 404 });

  const account = await getCalendarAccount(profile.id);
  if (!account) return NextResponse.json({ error: "Reconnecte Google Calendar avant de supprimer ce rendez-vous." }, { status: 400 });

  try {
    await deleteGoogleCalendarEvent(account, event.google_event_id);
    const { error } = await supabase.from("calendar_events").delete().eq("id", id).eq("profile_id", profile.id);
    if (error) throw new Error(error.message);

    const now = new Date().toISOString();
    const [{ data: nextEvent }, { data: nextComparatif }] = await Promise.all([
      supabase.from("calendar_events").select("kind, start_at").eq("prospect_id", event.prospect_id).eq("profile_id", profile.id).gte("end_at", now).order("start_at", { ascending: true }).limit(1).maybeSingle(),
      supabase.from("calendar_events").select("start_at").eq("prospect_id", event.prospect_id).eq("profile_id", profile.id).eq("kind", "rdv").gte("end_at", now).order("start_at", { ascending: true }).limit(1).maybeSingle(),
    ]);

    await supabase.from("prospects").update({
      next_action: nextEvent ? nextActionLabel(nextEvent.kind as "rdv" | "rappel", nextEvent.start_at) : null,
      next_action_date: nextComparatif?.start_at ? nextComparatif.start_at.slice(0, 10) : null,
      last_action_at: now,
    }).eq("id", event.prospect_id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Suppression impossible." }, { status: 500 });
  }
}
