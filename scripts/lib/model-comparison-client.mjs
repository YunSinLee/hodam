import { createHash } from "node:crypto";
import { OpenAI } from "openai";
import {
  canReserve,
  comparisonParams,
  mustStop,
  reserveCost,
  safeFailure,
  usageCost,
} from "./model-comparison.mjs";

// This client is only injected into the isolated evaluation bundle.
export const evaluation = {
  calls: [],
  current: null,
  context: null,
  budget: 10,
  stop: null,
  checkpoint: async () => {},
};

export async function withPicturebookModelTelemetry(context, invoke) {
  const before = evaluation.context;
  evaluation.context = context;
  try {
    return await invoke();
  } finally {
    evaluation.context = before;
  }
}

export class RecordingOpenAI {
  constructor(config) {
    const client = new OpenAI({ ...config, maxRetries: 0 });
    this.chat = {
      completions: {
        create: async (original, options) => {
          if (!evaluation.current)
            throw new Error("No evaluation case selected");
          if (evaluation.stop)
            throw Object.assign(
              new Error("Evaluation stopped"),
              evaluation.stop,
            );
          const params = comparisonParams(original);
          if (!canReserve(evaluation.calls, params, evaluation.budget)) {
            const error = Object.assign(
              new Error("Comparison budget reached"),
              { name: "BudgetLimitError" },
            );
            evaluation.stop = safeFailure(error);
            throw error;
          }
          const call = {
            ...evaluation.current,
            ...evaluation.context,
            model: params.model,
            reasoningEffort: params.reasoning_effort,
            maxCompletionTokens: params.max_completion_tokens,
            requestHash: createHash("sha256")
              .update(JSON.stringify(params))
              .digest("hex"),
            timeoutMs: options.timeout,
            reservedUSD: reserveCost(params),
            outcome: "pending",
          };
          evaluation.calls.push(call);
          // Persist the reservation before dispatch. Interrupted calls stay reserved.
          await evaluation.checkpoint();
          const started = Date.now();
          try {
            const response = await client.chat.completions.create(
              params,
              options,
            );
            Object.assign(call, {
              ms: Date.now() - started,
              outcome: "response",
              usage: response.usage,
              cost: usageCost(params.model, response.usage),
              content: response.choices[0]?.message.content,
              finishReason: response.choices[0]?.finish_reason,
              returnedModel: response.model,
            });
            return response;
          } catch (error) {
            Object.assign(call, {
              ms: Date.now() - started,
              outcome: "error",
              error: safeFailure(error),
            });
            if (mustStop(error)) evaluation.stop = safeFailure(error);
            throw error;
          } finally {
            await evaluation.checkpoint();
          }
        },
      },
    };
    this.images = {
      generate() {
        throw new Error("Images are disabled in model comparison");
      },
    };
  }
}
