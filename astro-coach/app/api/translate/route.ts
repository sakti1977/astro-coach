import { NextRequest, NextResponse } from "next/server";
import { getApiAccessContext } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { translateText } from "@/lib/sarvam";
import { safeClientErrorMessage } from "@/lib/safe-error";

export async function POST(req: NextRequest) {
  const access = await getApiAccessContext(req);
  if (access instanceof NextResponse) return access;

  if (!(await checkRateLimit(access.rateLimitKey))) {
    return NextResponse.json({ error: "Too many requests — please wait a moment" }, { status: 429 });
  }

  if (!process.env.SARVAM_API_KEY) {
    return NextResponse.json({ error: "Translation is not configured" }, { status: 503 });
  }

  try {
    const { text, sourceLanguageCode, targetLanguageCode } = (await req.json()) as {
      text: string;
      sourceLanguageCode: string;
      targetLanguageCode: string;
    };

    if (!text || !sourceLanguageCode || !targetLanguageCode) {
      return NextResponse.json({ error: "text, sourceLanguageCode, and targetLanguageCode are required" }, { status: 400 });
    }

    const { translatedText } = await translateText(text, sourceLanguageCode, targetLanguageCode);
    return NextResponse.json({ translatedText });
  } catch (err: unknown) {
    const msg = safeClientErrorMessage(err, "Translation failed. Please try again shortly.", "translate");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
