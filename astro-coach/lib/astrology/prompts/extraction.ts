export function buildObservationExtractionPrompt(
  userMessage: string,
  assistantResponse: string,
  exchangeCount: number,
  todayIso?: string
): string {
  const dateNote = todayIso ? `\nSession date: ${new Date(todayIso).toDateString()}` : "";
  return `Analyze this coaching exchange and extract structured observations about the user.${dateNote}

USER MESSAGE:
"${userMessage}"

COACH RESPONSE:
"${assistantResponse}"

This is exchange #${exchangeCount} in the session.

Extract any meaningful observations about the user's life, patterns, or challenges from what they shared.
Also decide if there is enough context to shift from observation-gathering to giving concrete recommendations.

Rules:
- Only extract observations if the user shared specific, personal information (not generic questions)
- "shouldTransitionToRecommending" should be true if ANY of these conditions is met:
  1. exchange >= 6 (enough exchanges have passed — stop gathering, start recommending)
  2. exchange >= 3 AND the user has revealed at least TWO of: current life situation, a recurring struggle, a specific behavior pattern, a stated goal, or a concrete block
  3. The coach has asked 4+ questions already — pivot to recommendations now
- Be DECISIVE — err toward transitioning sooner. Waiting for perfect data delays useful guidance.
- Use category: "behavior" (actions/reactions), "emotion" (feelings/states), "pattern" (recurring themes), "goal" (aspirations), "block" (obstacles/resistance)

Return ONLY raw JSON with no explanation, no markdown:
{
  "observations": [
    {"text": "...", "category": "behavior|emotion|pattern|goal|block"}
  ],
  "shouldTransitionToRecommending": true|false
}

If the user's message was too brief, generic, or a question with no personal disclosure, return:
{"observations": [], "shouldTransitionToRecommending": false}`;
}

export function buildObservationSummarisationPrompt(
  observations: Array<{ text: string; category: string }>,
  exchangeCount: number
): string {
  const list = observations.map((o, i) => `${i + 1}. [${o.category}] ${o.text}`).join("\n");
  return `You are summarising coaching observations gathered over ${exchangeCount} exchanges.

OBSERVATIONS TO COMPRESS:
${list}

Distil these into 5–7 consolidated behavioural profile points. Each point should be a single sentence capturing a clear, durable insight about the person.

Return ONLY raw JSON — no markdown, no explanation:
{"summaryObservations": [
  {"text": "...", "category": "behavior|emotion|pattern|goal|block"},
  ...
]}`;
}
