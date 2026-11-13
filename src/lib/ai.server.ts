// Server-only Lovable AI helper. Internals may be replaced later via GitHub.
import { createAnthropic } from "@ai-sdk/anthropic";
import { APICallError, Output, jsonSchema, streamText } from "ai";

const MODELS = {
  small: "anthropic/claude-haiku-4-5",
  large: "anthropic/claude-sonnet-5",
} as const;

export class AIError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: "credits" | "rate_limited" | "denied" | "refused" | "config" | "failed",
  ) {
    super(message);
  }
}

export async function callAI<T = unknown>({
  model,
  system,
  user,
  jsonSchema: schema,
}: {
  model: "small" | "large";
  system: string;
  user: string;
  jsonSchema: Record<string, unknown>;
}): Promise<T> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new AIError("AI is not configured (missing LOVABLE_API_KEY).", 401, "config");

  const anthropic = createAnthropic({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });

  try {
    const result = streamText({
      model: anthropic(MODELS[model]),
      maxRetries: 0, // never retry, including on 402/429
      maxOutputTokens: 16000,
      system,
      messages: [{ role: "user", content: user }],
      output: Output.object({ schema: jsonSchema(schema) }),
    });
    const finish = await result.finishReason;
    if ((finish as string) === "content-filter") {
      throw new AIError("The AI model declined this request.", 200, "refused");
    }
    return (await result.output) as T;
  } catch (err) {
    if (err instanceof AIError) throw err;
    const status = APICallError.isInstance(err) ? err.statusCode : undefined;
    if (status === 402) throw new AIError("Out of AI credits. Add credits in Settings → Plans & credits.", 402, "credits");
    if (status === 429) throw new AIError("AI rate limit reached. Try again later.", 429, "rate_limited");
    if (status === 403) throw new AIError("AI access was denied for this request.", 403, "denied");
    console.error("callAI failed", err);
    throw new AIError("AI request failed.", status ?? 500, "failed");
  }
}
