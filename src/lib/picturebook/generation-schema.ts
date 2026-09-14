import type { ResponseFormatJSONSchema } from "openai/resources/shared";

type JsonSchema = Record<string, unknown>;

function text(minLength: number, maxLength: number): JsonSchema {
  return { type: "string", minLength, maxLength };
}

function object(properties: Record<string, JsonSchema>): JsonSchema {
  return {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}

function array(
  items: JsonSchema,
  minItems: number,
  maxItems: number,
): JsonSchema {
  return { type: "array", items, minItems, maxItems };
}

export function getDraftResponseFormat(
  stage: "start" | "ending",
): ResponseFormatJSONSchema {
  const page = object({
    pageNumber: {
      type: "integer",
      enum: stage === "start" ? [1, 2, 3, 4] : [5, 6, 7, 8],
    },
    textKo: text(12, 900),
    imagePrompt: text(1, 1200),
    emotionalBeat: {
      type: "string",
      enum: ["setup", "tension", "choice", "resolution", "calm-close"],
    },
  });
  const endingFields = {
    pages: array(page, 4, 4),
    safetyNotes: array(text(0, 500), 0, 50),
    qualityNotes: array(text(0, 500), 0, 50),
    revisionNotes: array(text(0, 500), 0, 50),
  };
  const properties =
    stage === "start"
      ? {
          title: text(1, 200),
          storyGuide: object({
            coreConflict: text(1, 600),
            characters: array(text(1, 100), 1, 6),
            keyObject: text(1, 200),
            resolutionGoal: text(1, 600),
            visualStyle: text(1, 1200),
          }),
          choice: object({
            afterPage: { type: "integer", enum: [4] },
            promptKo: text(1, 500),
            options: array(
              object({
                id: { type: "string", enum: ["A", "B", "C"] },
                labelKo: text(1, 40),
                resolutionHint: text(1, 1000),
              }),
              3,
              3,
            ),
          }),
          ...endingFields,
        }
      : endingFields;

  return {
    type: "json_schema",
    json_schema: {
      name: `picturebook_${stage}_v1`,
      strict: true,
      schema: object(properties),
    },
  };
}
