import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

export async function validateChart(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const client = getClient();
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",  // TOKEN-01: was claude-opus-4-7 (~80% cost reduction)
    max_tokens: 1024,             // TOKEN-01: was 2048; validation JSON array fits easily
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
  profileContext: string   // dynamic observations — kept separate for cache efficiency
): AsyncGenerator<string> {
  const client = getClient();

  // Block 1: large static prompt (chart data + all coaching instructions).
  // This block NEVER changes within a user session → always gets a cache hit
  // after the first call, dramatically cutting time-to-first-token.
  //
  // Block 2: small dynamic block (current observations / profile state).
  // Changes occasionally as observations accumulate; kept separate so Block 1
  // cache is not busted.
  const systemBlocks: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: systemPrompt,
      cache_control: { type: "ephemeral" },
    },
  ];

  if (profileContext.trim()) {
    systemBlocks.push({
      type: "text",
      text: profileContext,
      // No cache_control — this block changes every time goals/phase/observations
      // update. Block 1 carries the ephemeral cache; this block stays uncached.
    });
  }

  const stream = await client.messages.stream({
    model: "claude-haiku-4-5",   // 5–8× faster than Sonnet; ideal for real-time chat
    max_tokens: 700,             // coaching replies don't need > 700 tokens
    system: systemBlocks,
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
    max_tokens: 700,   // TOKEN-02: was 1500; dasha JSON (5 keys, ~500 tokens) fits comfortably
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
