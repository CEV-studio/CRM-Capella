import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireProfile();
  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("prospect_notes")
    .select("id, body, author_name, created_at")
    .eq("prospect_id", id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ notes: data ?? [] });
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
    .select("id, body, author_name, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Compatibilité avec les écrans/exports historiques qui lisent encore prospects.notes.
  await supabase.from("prospects").update({ notes: body, last_action_at: new Date().toISOString() }).eq("id", id);

  return NextResponse.json({ note: data });
}
