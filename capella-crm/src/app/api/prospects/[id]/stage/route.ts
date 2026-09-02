import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PROSPECTION_STAGES } from "@/lib/domain/stages";

const ALLOWED = new Set(PROSPECTION_STAGES.map((stage) => stage.label));

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireProfile();
  const { id } = await params;
  const input = await request.json().catch(() => ({})) as { stage?: string; koReason?: string };
  const stage = String(input.stage || "").trim();
  const koReason = String(input.koReason || "").trim();

  if (!ALLOWED.has(stage as (typeof PROSPECTION_STAGES)[number]["label"])) {
    return NextResponse.json({ error: "Étape de prospection invalide." }, { status: 400 });
  }
  if (stage === "KO" && !koReason) {
    return NextResponse.json({ error: "Le motif du KO est obligatoire." }, { status: 400 });
  }

  const supabase = await createClient();
  if(stage==="Demande ACD"){
    const {data:acd}=await (supabase as any).from("acd_requests").select("id").eq("prospect_id",id).in("status",["a_traiter","en_cours","terminee"]).limit(1).maybeSingle();
    if(!acd) return NextResponse.json({error:"Complète et envoie d’abord la demande d’ACD."},{status:400});
  }
  const patch: { stage: string; ko_reason?: string | null; last_action_at: string } = {
    stage,
    last_action_at: new Date().toISOString(),
  };
  patch.ko_reason = stage === "KO" ? koReason : null;

  const { error } = await supabase.from("prospects").update(patch).eq("id", id).is("deleted_at", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  revalidatePath("/prospection");
  revalidatePath("/clients");
  revalidatePath(`/prospection/${id}`);
  return NextResponse.json({ ok: true, stage });
}
