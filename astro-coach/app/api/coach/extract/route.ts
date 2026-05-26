import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildObservationExtractionPrompt } from "@/lib/astrology/prompts";

let _client: Anthropic | null = null;
function getClient() {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

export async function POST(req: NextRequest) {
  const { userMessage, assistantResponse, exchangeCount } = (await req.json()) as {
    userMessage: string;
    assistantResponse: string;
    exchangeCount: number;
  };

  const prompt = buildObservationExtractionPrompt(userMessage, assistantResponse, exchangeCount, new Date().toISOString());

  try {
    const response = await getClient().messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const block = response.content[0];
    if (block.type !== "text") {
      return Response.json({ observations: [], shouldTransitionToRecommending: false });
    }

    const text = block.text.trim();
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) {
      return Response.json({ observations: [], shouldTransitionToRecommending: false });
    }

    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
    return Response.json({
      observations: Array.isArray(parsed.observations) ? parsed.observations : [],
      shouldTransitionToRecommending: Boolean(parsed.shouldTransitionToRecommending),
    });
  } catch {
    return Response.json({ observations: [], shouldTransitionToRecommending: false });
  }
}
