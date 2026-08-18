import Anthropic from "@anthropic-ai/sdk";

export type DMProvider = "anthropic" | "local_llama" | "ollama" | "demo_cached";

export type DMChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type NarrationServiceIssue = {
  title: string;
  detail: string;
  resolution: string;
};

type GenerateNarrationTextParams = {
  system: string;
  messages: DMChatMessage[];
  maxTokens: number;
  purpose: string;
};

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-5";
const DEFAULT_ANTHROPIC_FALLBACK_MODELS = [
  "claude-haiku-4-5-20251001",
];

function normalizeProvider(rawProvider: string | undefined, allowEmpty = false): DMProvider | null {
  const provider = (rawProvider || "").trim().toLowerCase();
  if (!provider || provider === "none") return allowEmpty ? null : "anthropic";
  if (provider === "local" || provider === "llama" || provider === "local_llm") return "local_llama";
  if (provider === "local_llama" || provider === "ollama") return provider;
  if (provider === "demo" || provider === "demo_cached" || provider === "cached") return "demo_cached";
  return "anthropic";
}

export const DM_AI_PROVIDER: DMProvider =
  normalizeProvider(
    process.env.AI_PROVIDER ||
      process.env.DM_AI_PROVIDER ||
      process.env.DM_PROVIDER ||
      (process.env.LOCAL_LLM_MODEL || process.env.OLLAMA_MODEL ? "local_llama" : "anthropic"),
  ) || "anthropic";

const DM_AI_FALLBACK_PROVIDER = normalizeProvider(
  process.env.AI_FALLBACK_PROVIDER,
  true,
);

export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL;
const ANTHROPIC_FALLBACK_MODELS = (
  process.env.ANTHROPIC_FALLBACK_MODELS || DEFAULT_ANTHROPIC_FALLBACK_MODELS.join(",")
)
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean);
const ANTHROPIC_RETRY_ATTEMPTS = Number(process.env.ANTHROPIC_RETRY_ATTEMPTS || 3);
const ANTHROPIC_RETRY_BASE_MS = Number(process.env.ANTHROPIC_RETRY_BASE_MS || 750);

export const OLLAMA_BASE_URL = (
  process.env.LOCAL_LLM_BASE_URL ||
  process.env.OLLAMA_BASE_URL ||
  "http://127.0.0.1:11434"
).replace(/\/+$/, "");
export const OLLAMA_MODEL = process.env.LOCAL_LLM_MODEL || process.env.OLLAMA_MODEL || "dmos-dms";
const OLLAMA_NUM_CTX = Number(process.env.OLLAMA_NUM_CTX || 8192);
const OLLAMA_TEMPERATURE = Number(process.env.DM_TEMPERATURE || 0.7);
const AI_REQUEST_TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS || 120000);

class OllamaProviderError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "OllamaProviderError";
    this.status = status;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getHeaderValue(headers: unknown, name: string): string | undefined {
  if (!headers) return undefined;
  if (typeof (headers as any).get === "function") {
    return (headers as any).get(name) ?? undefined;
  }
  if (typeof headers === "object") {
    const exact = (headers as Record<string, unknown>)[name];
    if (typeof exact === "string") return exact;
    const lower = (headers as Record<string, unknown>)[name.toLowerCase()];
    if (typeof lower === "string") return lower;
  }
  return undefined;
}

function getErrorMessage(error: unknown): string {
  const direct = String((error as any)?.message || "");
  const cause = String((error as any)?.cause?.message || "");
  return [direct, cause].filter(Boolean).join(" :: ");
}

function extractAnthropicText(response: any): string {
  return response.content
    .filter((block: any) => block.type === "text")
    .map((block: any) => block.text)
    .join("")
    .trim();
}

function isRetryableAnthropicError(error: unknown): boolean {
  const status = Number((error as any)?.status);
  const shouldRetry = getHeaderValue((error as any)?.headers, "x-should-retry");
  const message = getErrorMessage(error);

  return (
    shouldRetry === "true" ||
    [408, 409, 429, 500, 502, 503, 504, 529].includes(status) ||
    /overloaded|temporar|timeout|timed out|rate limit|econnreset|socket hang up/i.test(message)
  );
}

async function createAnthropicMessageWithRetry(
  params: Parameters<typeof anthropic.messages.create>[0],
  purpose: string,
) {
  let lastError: unknown;
  const requestedModel = String((params as any).model || ANTHROPIC_MODEL);
  const modelCandidates = [requestedModel, ...ANTHROPIC_FALLBACK_MODELS.filter((model) => model !== requestedModel)];

  for (let modelIndex = 0; modelIndex < modelCandidates.length; modelIndex += 1) {
    const model = modelCandidates[modelIndex];

    for (let attempt = 1; attempt <= ANTHROPIC_RETRY_ATTEMPTS; attempt += 1) {
      try {
        return await anthropic.messages.create({
          ...params,
          model,
        });
      } catch (error) {
        lastError = error;

        if (!isRetryableAnthropicError(error)) {
          throw error;
        }

        if (attempt < ANTHROPIC_RETRY_ATTEMPTS) {
          const delayMs =
            ANTHROPIC_RETRY_BASE_MS * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 250);
          console.warn(
            `Anthropic ${purpose} retry ${attempt}/${ANTHROPIC_RETRY_ATTEMPTS} on ${model} after ${delayMs}ms`,
            error,
          );
          await sleep(delayMs);
          continue;
        }

        const nextModel = modelCandidates[modelIndex + 1];
        if (nextModel) {
          console.warn(
            `Anthropic ${purpose} exhausted retries on ${model}; failing over to ${nextModel}`,
            error,
          );
          break;
        }

        throw error;
      }
    }
  }

  throw lastError;
}

async function generateAnthropicNarration(
  params: GenerateNarrationTextParams,
): Promise<string> {
  const response = await createAnthropicMessageWithRetry(
    {
      model: ANTHROPIC_MODEL,
      max_tokens: params.maxTokens,
      system: params.system,
      messages: params.messages,
      // Extended thinking is on by default for this model and shares the same
      // max_tokens budget as visible output — without disabling it, thinking
      // tokens can consume the whole budget and cut the narration off mid-sentence.
      thinking: { type: "disabled" },
    },
    params.purpose,
  );

  return extractAnthropicText(response);
}

async function generateOllamaNarration(
  params: GenerateNarrationTextParams,
): Promise<string> {
  let response: Response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);

  try {
    response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        messages: [{ role: "system", content: params.system }, ...params.messages],
        options: {
          num_ctx: OLLAMA_NUM_CTX,
          temperature: OLLAMA_TEMPERATURE,
          num_predict: params.maxTokens,
        },
      }),
    });
  } catch (error) {
    throw new OllamaProviderError(
      getErrorMessage(error) || "Could not reach the local Ollama server.",
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    let detail = `Ollama request failed with status ${response.status}.`;
    try {
      const payload = await response.json();
      if (typeof payload?.error === "string" && payload.error.trim()) {
        detail = payload.error.trim();
      }
    } catch {
      const text = await response.text();
      if (text.trim()) detail = text.trim();
    }

    throw new OllamaProviderError(detail, response.status);
  }

  const payload = await response.json();
  const content = payload?.message?.content;

  if (typeof content !== "string" || !content.trim()) {
    throw new OllamaProviderError("Ollama returned an empty chat response.");
  }

  return content.trim();
}

function generateDemoCachedNarration(params: GenerateNarrationTextParams): string {
  const latestUserMessage = [...params.messages].reverse().find((message) => message.role === "user")?.content || "";
  const compactAction = latestUserMessage.replace(/\s+/g, " ").trim().slice(0, 220);
  const isOpening = /opening|start/i.test(params.purpose);

  if (isOpening) {
    return `The scene opens with enough clarity to move, even if the full Dungeon Master is still gathering its voice. The air carries a charged stillness; nearby details sharpen one by one, revealing a place with pressure, consequence, and something just out of sight.

You have room to act, but not forever. Something in this place is already reacting to your arrival.

What do you do?`;
  }

  return `You commit to the action: ${compactAction || "you press forward"}.

The situation answers in kind. The immediate world shifts around that choice: attention turns, nearby risks become clearer, and the scene moves from waiting into consequence. Nothing feels arbitrary; whatever happens next follows from the pressure already in motion.

What do you do next?`;
}

async function generateWithProvider(provider: DMProvider, params: GenerateNarrationTextParams): Promise<string> {
  if (provider === "ollama" || provider === "local_llama") {
    return generateOllamaNarration(params);
  }

  if (provider === "demo_cached") {
    return generateDemoCachedNarration(params);
  }

  return generateAnthropicNarration(params);
}

export async function generateNarrationText(
  params: GenerateNarrationTextParams,
): Promise<string> {
  try {
    return await generateWithProvider(DM_AI_PROVIDER, params);
  } catch (error) {
    if (!DM_AI_FALLBACK_PROVIDER || DM_AI_FALLBACK_PROVIDER === DM_AI_PROVIDER) {
      throw error;
    }

    console.warn(
      `Primary DM provider ${DM_AI_PROVIDER} failed for ${params.purpose}; trying ${DM_AI_FALLBACK_PROVIDER}.`,
      error,
    );

    return generateWithProvider(DM_AI_FALLBACK_PROVIDER, params);
  }
}

export function getNarrationServiceLabel(): string {
  if (DM_AI_PROVIDER === "ollama" || DM_AI_PROVIDER === "local_llama") return "local Llama/Ollama Dungeon Master";
  if (DM_AI_PROVIDER === "demo_cached") return "demo cached Dungeon Master";
  return "Anthropic-powered Dungeon Master";
}

export function getNarrationServiceIssue(error: unknown): NarrationServiceIssue | null {
  const status = Number((error as any)?.status);
  const message = getErrorMessage(error);

  if (DM_AI_PROVIDER === "ollama" || DM_AI_PROVIDER === "local_llama") {
    if (/model .*not found|pull it first|manifest .* not found/i.test(message)) {
      return {
        title: "Local Ollama model missing",
        detail: `DMOS is configured to use the local Ollama model "${OLLAMA_MODEL}", but Ollama cannot find it yet.`,
        resolution: `Pull or create the "${OLLAMA_MODEL}" model locally, then try again.`,
      };
    }

    if (/fetch failed|econnrefused|could not connect to a running ollama instance|failed to connect/i.test(message)) {
      return {
        title: "Local Ollama server unavailable",
        detail: `DMOS is configured to use Ollama at ${OLLAMA_BASE_URL}, but nothing answered there.`,
        resolution: "Start Ollama locally, keep it running, and then try again.",
      };
    }

    if (status >= 500) {
      return {
        title: "Local Ollama request failed",
        detail: "The local Ollama server was reached, but it failed while generating narration.",
        resolution: "Check the Ollama console for model/runtime errors, then try again.",
      };
    }

    return null;
  }

  if (/credit balance is too low|purchase credits|plans & billing/i.test(message)) {
    return {
      title: "Anthropic credits exhausted",
      detail:
        "The configured Anthropic account was reached, but it has no remaining API credits.",
      resolution: "Top up the Anthropic account credits or replace the API key, then try again.",
    };
  }

  if (status === 401 || status === 403 || /invalid x-api-key|authentication|unauthorized|forbidden/i.test(message)) {
    return {
      title: "Anthropic authentication failed",
      detail:
        "DMOS could not authenticate with Anthropic using the configured API credentials.",
      resolution: "Check the Anthropic API key and account access, then try again.",
    };
  }

  if (/model: .*not_found|invalid_request_error/i.test(message) && /model/i.test(message)) {
    return {
      title: "Anthropic model configuration failed",
      detail:
        "DMOS is configured to use an Anthropic model that is unavailable to this account or no longer valid.",
      resolution: "Change the Anthropic model setting to a valid model for this account, then try again.",
    };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      title: "Anthropic API key missing",
      detail: "DMOS does not currently have an Anthropic API key configured.",
      resolution: "Add an Anthropic API key or switch DMOS to the local Ollama provider, then try again.",
    };
  }

  return null;
}
