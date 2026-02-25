import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, reason: "no_session" });
  }

  const { data: profile, error } = await supabase.from("profiles").select("id,plan").eq("id", user.id).maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, uid: user.id, error: error.message });
  }

  return NextResponse.json({
    ok: true,
    uid: user.id,
    plan: profile?.plan ?? null,
    profileExists: Boolean(profile),
    error: null,
  });
}
