import { NextRequest, NextResponse } from "next/server";
import { getApiAccessContext } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { safeClientErrorMessage } from "@/lib/safe-error";
import { parseFeedback } from "@/lib/coach-feedback";
import { MODEL_PRIMARY } from "@/lib/constants";

/**
 * Thumbs up/down on a coaching reply. Stored server-side with the
 * service-role client, scoped to the verified session user
 * (NON_NEGOTIABLES.md #1). Only the coach's reply is stored with the rating,
 * never the user's own messages.
 */
export async function POST(req: NextRequest) {
  const access = await getApiAccessContext(req);
  if (access instanceof NextResponse) return access;
  if (!access.session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await checkRateLimit(access.rateLimitKey))) {
    return NextResponse.json({ error: "Too many requests — please wait a moment" }, { status: 429 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Feedback storage is not configured" }, { status: 503 });
  }

  const parsed = parseFeedback(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const fb = parsed.value;
  const userId = access.session.user.id;

  try {
    if (fb.rating === null) {
      const { error } = await supabaseAdmin
        .from("coach_feedback")
        .delete()
        .eq("user_id", userId)
        .eq("message_timestamp", fb.messageTimestamp);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    const { error } = await supabaseAdmin.from("coach_feedback").upsert(
      {
        user_id: userId,
        message_timestamp: fb.messageTimestamp,
        rating: fb.rating === "up" ? 1 : -1,
        reason: fb.reason ?? null,
        reply: fb.reply,
        phase: fb.phase ?? null,
        tone: fb.tone ?? null,
        model: MODEL_PRIMARY,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,message_timestamp" }
    );
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = safeClientErrorMessage(err, "Couldn't save your feedback. Please try again.", "coach/feedback");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
