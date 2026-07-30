import { NextRequest, NextResponse } from "next/server";
import { getApiAccessContext } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { speechToText } from "@/lib/sarvam";
import { safeClientErrorMessage } from "@/lib/safe-error";

export async function POST(req: NextRequest) {
  const access = await getApiAccessContext(req);
  if (access instanceof NextResponse) return access;

  if (!(await checkRateLimit(access.rateLimitKey))) {
    return NextResponse.json({ error: "Too many requests — please wait a moment" }, { status: 429 });
  }

  if (!process.env.SARVAM_API_KEY) {
    return NextResponse.json({ error: "Voice input is not configured" }, { status: 503 });
  }

  try {
    const form = await req.formData();
    const file = form.get("audio");
    const languageCode = (form.get("languageCode") as string) || "unknown";

    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "audio file is required" }, { status: 400 });
    }

    const result = await speechToText(file, "recording.webm", languageCode);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = safeClientErrorMessage(err, "Speech-to-text failed. Please try again shortly.", "speech-to-text");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
