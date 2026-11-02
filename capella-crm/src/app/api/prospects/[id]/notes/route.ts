import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Legacy imports write directly to prospects.notes. Preserve that value before any
// timeline mutation can replace the preview on the prospect record.
async function preserveLegacyNote(supabase: SupabaseClient, prospectId: string, profile: {id:string}) {
  const { data: prospect, error: prospectError } = await supabase.from("prospects")
    .select("notes, created_at").eq("id", prospectId).maybeSingle();
  if (prospectError) throw new Error(prospectError.message);
  if (!prospect) throw new Error("Prospect introuvable.");
  const legacy = prospect.notes;
  if (!legacy || !legacy.trim()) return null;
  const { data: existing, error: existingError } = await supabase.from("prospect_notes")
    .select("id").eq("prospect_id", prospectId).eq("body", legacy).limit(1).maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing) return existing.id as string;
  const { data, error } = await supabase.from("prospect_notes").insert({
    prospect_id: prospectId, author_id: profile.id, author_name: "Note historique",
    body: legacy, created_at: prospect.created_at || new Date().toISOString(),
  }).select("id").single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

async function syncLegacyLatestNote(supabase: SupabaseClient, prospectId: string) {
  const { data: latest } = await supabase
    .from("prospect_notes")
    .select("body")
    .eq("prospect_id", prospectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase
    .from("prospects")
    .update({ notes: latest?.body ?? null, last_action_at: new Date().toISOString() })
    .eq("id", prospectId);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await requireProfile();
  const { id } = await params;
  const supabase = await createClient();
  const { data: prospect, error: prospectError } = await supabase.from("prospects").select("notes, created_at").eq("id", id).maybeSingle();
  if (prospectError) return NextResponse.json({ error: prospectError.message }, { status: 400 });
  if (!prospect) return NextResponse.json({ error: "Prospect introuvable." }, { status: 404 });
  const { data, error } = await (supabase as unknown as SupabaseClient)
    .from("prospect_notes")
    .select("id, body, author_id, author_name, created_at, updated_at")
    .eq("prospect_id", id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const notes = (data ?? []).map((note: {id:string;body:string;author_id:string|null;author_name:string;created_at:string;updated_at:string|null}) => ({
    ...note,
    can_edit: profile.role === "admin" || note.author_id === profile.id,
  }));
  if (prospect.notes?.trim() && !notes.some((note: {body:string}) => note.body === prospect.notes)) {
    // The preview may be older than the 100 most recent entries.
    const { data: matching, error: matchingError } = await (supabase as unknown as SupabaseClient).from("prospect_notes")
      .select("id").eq("prospect_id", id).eq("body", prospect.notes).limit(1).maybeSingle();
    if (matchingError) return NextResponse.json({ error: matchingError.message }, { status: 400 });
    if (!matching) notes.push({ id: "legacy", body: prospect.notes, author_id: null, author_name: "Note historique", created_at: prospect.created_at, updated_at: null, can_edit: true });
  }
  return NextResponse.json({ notes });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await requireProfile();
  const { id } = await params;
  const payload = await request.json().catch(() => ({})) as { body?: string };
  const body = String(payload.body ?? "").trim();
  if (!body) return NextResponse.json({ error: "La note est vide." }, { status: 400 });
  if (body.length > 5000) return NextResponse.json({ error: "La note est trop longue." }, { status: 400 });

  const supabase = await createClient();
  try { await preserveLegacyNote(supabase as unknown as SupabaseClient, id, profile); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Conservation de la note impossible." }, { status: 400 }); }
  const { data, error } = await (supabase as unknown as SupabaseClient)
    .from("prospect_notes")
    .insert({
      prospect_id: id,
      author_id: profile.id,
      author_name: profile.full_name,
      body,
    })
    .select("id, body, author_id, author_name, created_at, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabase.from("prospects").update({ notes: body, last_action_at: new Date().toISOString() }).eq("id", id);

  return NextResponse.json({ note: { ...data, can_edit: true } });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await requireProfile();
  const { id } = await params;
  const payload = await request.json().catch(() => ({})) as { noteId?: string; body?: string };
  let noteId = String(payload.noteId ?? "").trim();
  const body = String(payload.body ?? "").trim();
  if (!noteId) return NextResponse.json({ error: "Note introuvable." }, { status: 400 });
  if (!body) return NextResponse.json({ error: "La note est vide." }, { status: 400 });
  if (body.length > 5000) return NextResponse.json({ error: "La note est trop longue." }, { status: 400 });

  const supabase = await createClient();
  try { const legacyId = await preserveLegacyNote(supabase as unknown as SupabaseClient, id, profile); if (noteId === "legacy") noteId = legacyId || ""; }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Conservation de la note impossible." }, { status: 400 }); }
  if (!noteId) return NextResponse.json({ error: "Note introuvable." }, { status: 404 });
  const now = new Date().toISOString();
  let query = (supabase as unknown as SupabaseClient)
    .from("prospect_notes")
    .update({ body, updated_at: now })
    .eq("id", noteId)
    .eq("prospect_id", id);
  if (profile.role !== "admin") query = query.eq("author_id", profile.id);

  const { data, error } = await query
    .select("id, body, author_id, author_name, created_at, updated_at")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Tu ne peux pas modifier cette note." }, { status: 403 });

  await syncLegacyLatestNote(supabase as unknown as SupabaseClient, id);
  return NextResponse.json({ note: { ...data, can_edit: true } });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await requireProfile();
  const { id } = await params;
  const payload = await request.json().catch(() => ({})) as { noteId?: string };
  let noteId = String(payload.noteId ?? "").trim();
  if (!noteId) return NextResponse.json({ error: "Note introuvable." }, { status: 400 });

  const supabase = await createClient();
  try { const legacyId = await preserveLegacyNote(supabase as unknown as SupabaseClient, id, profile); if (noteId === "legacy") noteId = legacyId || ""; }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Conservation de la note impossible." }, { status: 400 }); }
  if (!noteId) return NextResponse.json({ error: "Note introuvable." }, { status: 404 });
  let query = (supabase as unknown as SupabaseClient)
    .from("prospect_notes")
    .delete()
    .eq("id", noteId)
    .eq("prospect_id", id);
  if (profile.role !== "admin") query = query.eq("author_id", profile.id);

  const { data, error } = await query.select("id").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Tu ne peux pas supprimer cette note." }, { status: 403 });

  await syncLegacyLatestNote(supabase as unknown as SupabaseClient, id);
  return NextResponse.json({ ok: true });
}
