import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";
import { buildObservationExtractionPrompt } from "@/lib/astrology/prompts";
import { extractJsonObject } from "@/lib/claude-json";
import { MAX_TOKENS_EXTRACT } from "@/lib/constants";

let _client: Anthropic | null = null;
function getClient() {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

const FALLBACK = { observations: [], shouldTransitionToRecommending: false };

export async function POST(req: NextRequest) {
  // BUG-02: guard Claude spend — only enforce when auth is configured
  if (process.env.NEXTAUTH_SECRET) {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const { userMessage, assistantResponse, exchangeCount } = (await req.json()) as {
    userMessage: string;
    assistantResponse: string;
    exchangeCount: number;
  };

  const prompt = buildObservationExtractionPrompt(userMessage, assistantResponse, exchangeCount, new Date().toISOString());

  try {
    const response = await getClient().messages.create({
      model: "claude-haiku-4-5",
      max_tokens: MAX_TOKENS_EXTRACT,
      messages: [{ role: "user", content: prompt }],
    });

    const block = response.content[0];
    if (block.type !== "text") return NextResponse.json(FALLBACK);

    const parsed = extractJsonObject(block.text);
    return NextResponse.json({
      observations: Array.isArray(parsed.observations) ? parsed.observations : [],
      shouldTransitionToRecommending: Boolean(parsed.shouldTransitionToRecommending),
    });
  } catch {
    return NextResponse.json(FALLBACK);
  }
}
