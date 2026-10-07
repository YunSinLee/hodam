export type PicturebookModelPhase = "draft" | "review" | "repair" | "image";
export type PicturebookModelStage = "start" | "ending" | "image";

export interface PicturebookModelContext {
  model: string;
  phase: PicturebookModelPhase;
  stage: PicturebookModelStage;
}

// A configuration mistake must not turn an API key or arbitrary text into a log.
const LOGGABLE_MODELS = [
  "gpt-5.4",
  "gpt-5.4-mini",
  "gpt-5.4-nano",
  "gpt-6.1-sol",
  "gpt-6-luna",
  "gpt-image-2.5-flare",
  "gpt-image-2.5-sunburst",
  "gpt-image-2",
  "gpt-image-1.5",
  "gpt-image-1",
  "gpt-image-1-mini",
];

function loggableModel(model: string) {
  if (typeof model !== "string") return "unrecognized";
  const alias = model.replace(/-\d{4}-\d{2}-\d{2}$/, "");
  return LOGGABLE_MODELS.includes(alias) ? model : "unrecognized";
}

function ownValue(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return undefined;
  // Do not evaluate getters or accept inherited telemetry fields.
  return Object.getOwnPropertyDescriptor(value, key)?.value;
}

function tokenCount(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : undefined;
}

function responseUsage(response: unknown, phase: PicturebookModelPhase) {
  const usage = ownValue(response, "usage");
  const isImage = phase === "image";
  const inputDetails = ownValue(
    usage,
    isImage ? "input_tokens_details" : "prompt_tokens_details",
  );
  const outputDetails = ownValue(
    usage,
    isImage ? "output_tokens_details" : "completion_tokens_details",
  );
  const fields = {
    inputTokens: ownValue(usage, isImage ? "input_tokens" : "prompt_tokens"),
    outputTokens: ownValue(
      usage,
      isImage ? "output_tokens" : "completion_tokens",
    ),
    totalTokens: ownValue(usage, "total_tokens"),
    ...(isImage
      ? {
          inputTextTokens: ownValue(inputDetails, "text_tokens"),
          inputImageTokens: ownValue(inputDetails, "image_tokens"),
          outputTextTokens: ownValue(outputDetails, "text_tokens"),
          outputImageTokens: ownValue(outputDetails, "image_tokens"),
        }
      : {
          cachedInputTokens: ownValue(inputDetails, "cached_tokens"),
          reasoningTokens: ownValue(outputDetails, "reasoning_tokens"),
        }),
  };
  const sanitized: Record<string, number> = {};
  Object.entries(fields).forEach(([key, value]) => {
    const count = tokenCount(value);
    if (count !== undefined) sanitized[key] = count;
  });
  // Missing usage is unknown, never a zero-cost request.
  return Object.keys(sanitized).length ? sanitized : undefined;
}

function recordCall(
  context: PicturebookModelContext,
  startedAt: number,
  outcome: "success" | "failure",
  response?: unknown,
) {
  try {
    const usage = responseUsage(response, context.phase);
    // Never spread context, provider responses, errors, or user-supplied data.
    const event = {
      model: loggableModel(context.model),
      phase: ["draft", "review", "repair", "image"].includes(context.phase)
        ? context.phase
        : "unknown",
      stage: ["start", "ending", "image"].includes(context.stage)
        ? context.stage
        : "unknown",
      elapsedMs: Math.max(0, Math.round(performance.now() - startedAt)),
      outcome,
      ...(usage ? { usage } : {}),
    };
    // eslint-disable-next-line no-console
    console.info("picturebook_model_call", event);
  } catch {
    // Observability must not change a paid request's result or trigger a retry.
  }
}

/** Measures one API call. Success means an API response, not story approval. */
export async function withPicturebookModelTelemetry<T>(
  context: PicturebookModelContext,
  invoke: () => Promise<T>,
): Promise<T> {
  const startedAt = performance.now();
  let response: T;
  try {
    response = await invoke();
  } catch (error) {
    recordCall(context, startedAt, "failure");
    throw error;
  }
  recordCall(context, startedAt, "success", response);
  return response;
}
