import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

async function syncLegacyLatestNote(supabase: any, prospectId: string) {
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
  const { data, error } = await (supabase as any)
    .from("prospect_notes")
    .select("id, body, author_id, author_name, created_at, updated_at")
    .eq("prospect_id", id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const notes = (data ?? []).map((note: any) => ({
    ...note,
    can_edit: profile.role === "admin" || note.author_id === profile.id,
  }));
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
  const { data, error } = await (supabase as any)
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
  const noteId = String(payload.noteId ?? "").trim();
  const body = String(payload.body ?? "").trim();
  if (!noteId) return NextResponse.json({ error: "Note introuvable." }, { status: 400 });
  if (!body) return NextResponse.json({ error: "La note est vide." }, { status: 400 });
  if (body.length > 5000) return NextResponse.json({ error: "La note est trop longue." }, { status: 400 });

  const supabase = await createClient();
  const now = new Date().toISOString();
  let query = (supabase as any)
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

  await syncLegacyLatestNote(supabase, id);
  return NextResponse.json({ note: { ...data, can_edit: true } });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await requireProfile();
  const { id } = await params;
  const payload = await request.json().catch(() => ({})) as { noteId?: string };
  const noteId = String(payload.noteId ?? "").trim();
  if (!noteId) return NextResponse.json({ error: "Note introuvable." }, { status: 400 });

  const supabase = await createClient();
  let query = (supabase as any)
    .from("prospect_notes")
    .delete()
    .eq("id", noteId)
    .eq("prospect_id", id);
  if (profile.role !== "admin") query = query.eq("author_id", profile.id);

  const { data, error } = await query.select("id").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Tu ne peux pas supprimer cette note." }, { status: 403 });

  await syncLegacyLatestNote(supabase, id);
  return NextResponse.json({ ok: true });
}
