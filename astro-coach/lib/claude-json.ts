/**
 * Shared JSON extraction utilities for Claude API response parsing.
 * Eliminates the duplicate strip / sanitise / extract pattern that was
 * previously copy-pasted across every route handler.
 */

/**
 * Escape raw newline/tab/carriage-return characters that fall *inside* JSON
 * string literals, leaving structural whitespace between tokens untouched.
 *
 * A blind global regex here previously escaped every bare newline in the
 * whole payload — including the indentation Claude naturally produces for
 * pretty-printed JSON (e.g. the whitespace between `{` and the first key).
 * That turned valid structural whitespace into a literal backslash-n sitting
 * outside any string, which JSON.parse rejects immediately after `{`. Real
 * control characters inside a string value *do* need escaping (raw ones
 * aren't legal JSON), so this walks the string tracking string-literal state
 * (respecting `\"` and other escape sequences) and only escapes there.
 */
function escapeControlCharsInStrings(jsonStr: string): string {
  let result = "";
  let inString = false;

  for (let i = 0; i < jsonStr.length; i++) {
    const ch = jsonStr[i];

    if (inString && ch === "\\") {
      // Already-escaped sequence (\", \\, \n, \uXXXX, ...) — copy verbatim.
      result += ch + (jsonStr[i + 1] ?? "");
      i++;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      result += ch;
      continue;
    }

    if (inString && ch === "\n") result += "\\n";
    else if (inString && ch === "\t") result += "\\t";
    else if (inString && ch === "\r") result += "\\r";
    else result += ch;
  }

  return result;
}

/**
 * Strip markdown code fences, sanitise stray control characters, and return
 * the sub-string from the first `{` to the last `}`.
 * Throws if no object braces are found.
 *
 * Use this when you need the cleaned string but want to handle JSON.parse
 * yourself (e.g. when a regex fallback is required on parse failure).
 */
export function prepareJsonString(raw: string): string {
  const stripped = raw
    .replace(/```(?:json)?\s*/gi, "")
    .replace(/```/g, "")
    .trim();

  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");

  if (start === -1 || end === -1) {
    throw new Error(
      `Claude did not return a JSON object. Preview: ${raw.slice(0, 200)}`
    );
  }

  let jsonStr = stripped.slice(start, end + 1);

  // Remove stray C0/C1 control characters while preserving \n \t \r
  jsonStr = jsonStr.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, " ");

  // Escape bare (un-escaped) newlines/tabs/CRs, but only inside string
  // literals — structural whitespace between tokens must be left alone.
  jsonStr = escapeControlCharsInStrings(jsonStr);

  return jsonStr;
}

/**
 * Strip fences, sanitise, and parse the first JSON **object** in raw text.
 * Throws on missing braces or parse failure.
 */
export function extractJsonObject(raw: string): Record<string, unknown> {
  return JSON.parse(prepareJsonString(raw)) as Record<string, unknown>;
}

/**
 * Strip fences and parse the first JSON **array** in raw text.
 * Throws if no array bracket pair is found or parsing fails.
 */
export function extractJsonArray(raw: string): unknown[] {
  const stripped = raw
    .replace(/```(?:json)?\s*/gi, "")
    .replace(/```/g, "")
    .trim();

  const match = stripped.match(/\[[\s\S]*\]/);
  if (!match) {
    throw new Error(
      `Claude did not return a JSON array. Preview: ${raw.slice(0, 200)}`
    );
  }

  return JSON.parse(match[0]) as unknown[];
}
