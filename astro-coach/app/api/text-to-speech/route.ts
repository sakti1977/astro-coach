import { NextRequest, NextResponse } from "next/server";
import { getApiAccessContext } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { textToSpeech } from "@/lib/sarvam";

export async function POST(req: NextRequest) {
  const access = await getApiAccessContext(req);
  if (access instanceof NextResponse) return access;

  if (!(await checkRateLimit(access.rateLimitKey))) {
    return NextResponse.json({ error: "Too many requests — please wait a moment" }, { status: 429 });
  }

  if (!process.env.SARVAM_API_KEY) {
    return NextResponse.json({ error: "Voice output is not configured" }, { status: 503 });
  }

  try {
    const { text, targetLanguageCode } = (await req.json()) as {
      text: string;
      targetLanguageCode: string;
    };

    if (!text || !targetLanguageCode) {
      return NextResponse.json({ error: "text and targetLanguageCode are required" }, { status: 400 });
    }

    const result = await textToSpeech(text, targetLanguageCode);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Text-to-speech failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
