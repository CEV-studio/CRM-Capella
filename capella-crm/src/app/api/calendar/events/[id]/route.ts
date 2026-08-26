import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { deleteGoogleCalendarEvent, getCalendarAccount } from "@/lib/calendar";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await requireProfile();
  const { id } = await params;
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("calendar_events")
    .select("id, profile_id, google_event_id")
    .eq("id", id)
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (!event) return NextResponse.json({ error: "Rendez-vous introuvable." }, { status: 404 });

  const account = await getCalendarAccount(profile.id);
  if (!account) {
    return NextResponse.json({ error: "Reconnecte Google Calendar avant de supprimer ce rendez-vous." }, { status: 400 });
  }

  try {
    await deleteGoogleCalendarEvent(account, event.google_event_id);
    const { error } = await supabase.from("calendar_events").delete().eq("id", id).eq("profile_id", profile.id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Suppression impossible." }, { status: 500 });
  }
}
