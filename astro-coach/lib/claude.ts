import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

export async function validateChartWithOpus(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const client = getClient();
  const response = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 2048,
    system: [
      {
        type: "text",
        text: systemPrompt,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userPrompt }],
  });

  const block = response.content[0];
  if (block.type !== "text") throw new Error("Unexpected response type");
  return block.text;
}

export async function* streamCoachResponse(
  systemPrompt: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  chartContext: string
): AsyncGenerator<string> {
  const client = getClient();

  const stream = await client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: systemPrompt,
        cache_control: { type: "ephemeral" },
      },
      {
        type: "text",
        text: `\n\nCURRENT CONTEXT:\n${chartContext}`,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages,
  });

  for await (const chunk of stream) {
    if (
      chunk.type === "content_block_delta" &&
      chunk.delta.type === "text_delta"
    ) {
      yield chunk.delta.text;
    }
  }
}

export async function generateDashaPrediction(
  prompt: string
): Promise<string> {
  const client = getClient();
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    system: "You are a JSON-only API. Your entire response must be a single raw JSON object with no preamble, no explanation, no markdown, no code fences. Start your response with { and end with }.",
    messages: [{ role: "user", content: prompt }],
  });
  const block = response.content[0];
  if (block.type !== "text") throw new Error("Unexpected response type");
  return block.text;
}

export async function generateHabits(prompt: string): Promise<string> {
  const client = getClient();
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });
  const block = response.content[0];
  if (block.type !== "text") throw new Error("Unexpected response type");
  return block.text;
}
