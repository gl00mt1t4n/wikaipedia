export type ComplexityTier = "simple" | "medium" | "complex";

const DEFAULT_TIER: ComplexityTier = "medium";
const DEFAULT_COMPLEXITY_SCORE = 3;
const DEFAULT_CLASSIFIER_TIMEOUT_MS = 2200;
const DEFAULT_CLASSIFIER_MAX_COMPLETION_TOKENS = 220;

export const BID_CENTS_BY_TIER: Record<ComplexityTier, number> = {
  simple: 20,
  medium: 75,
  complex: 200
};

function normalizeTier(value: string): ComplexityTier {
  const lower = value.trim().toLowerCase();
  if (lower === "simple" || lower === "medium" || lower === "complex") {
    return lower;
  }
  return DEFAULT_TIER;
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_COMPLEXITY_SCORE;
  }
  return Math.min(5, Math.max(1, Math.round(value)));
}

function tierFromScore(score: number): ComplexityTier {
  if (score <= 2) {
    return "simple";
  }
  if (score >= 4) {
    return "complex";
  }
  return "medium";
}

function tierToScoreCenter(tier: ComplexityTier): number {
  if (tier === "simple") {
    return 2;
  }
  if (tier === "complex") {
    return 4;
  }
  return 3;
}

function lexicalComplexityScore(header: string, content: string): number {
  const text = `${header}\n${content}`.trim();
  const lower = text.toLowerCase();
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  let score = 2;

  if (wordCount >= 40) {
    score += 1;
  }
  if (wordCount >= 120) {
    score += 1;
  }

  const complexSignals = [
    /\btrade[- ]?off\b/g,
    /\barchitecture\b/g,
    /\bdesign\b/g,
    /\boptimi[sz]e\b/g,
    /\bdebug\b/g,
    /\bintegrat(e|ion)\b/g,
    /\bmigrat(e|ion)\b/g,
    /\bsecurity\b/g,
    /\bperformance\b/g,
    /\bscal(e|ability)\b/g,
    /\bmulti[- ]step\b/g,
    /\bdistributed\b/g,
    /\bconsensus\b/g,
    /\bcross[- ]chain\b/g,
    /\bsmart contract\b/g,
    /\bprisma\b/g,
    /\bsupabase\b/g,
    /\bnext\.?js\b/g
  ];

  const simpleSignals = [
    /^\s*what is\b/gm,
    /^\s*define\b/gm,
    /^\s*when is\b/gm,
    /^\s*where is\b/gm,
    /^\s*who is\b/gm
  ];

  let complexHits = 0;
  for (const pattern of complexSignals) {
    complexHits += (lower.match(pattern) ?? []).length;
  }
  if (complexHits >= 2) {
    score += 1;
  }
  if (complexHits >= 5) {
    score += 1;
  }

  let simpleHits = 0;
  for (const pattern of simpleSignals) {
    simpleHits += (lower.match(pattern) ?? []).length;
  }
  if (simpleHits > 0 && wordCount <= 25) {
    score -= 1;
  }

  if (lower.includes("```") || lower.includes("error:") || lower.includes("stack trace")) {
    score += 1;
  }

  return clampScore(score);
}

function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  return text.slice(start, end + 1);
}

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = Number(process.env[name] ?? "");
  if (!Number.isFinite(raw) || raw <= 0) {
    return fallback;
  }
  return Math.floor(raw);
}

function extractTextPayload(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (!Array.isArray(value)) {
    return "";
  }
  return value
    .map((part) => {
      if (typeof part === "string") return part;
      if (!part || typeof part !== "object") return "";
      const text = (part as { text?: unknown }).text;
      return typeof text === "string" ? text : "";
    })
    .filter(Boolean)
    .join("\n");
}

function fallbackClassification(input: { header: string; content: string }): {
  complexityTier: ComplexityTier;
  complexityScore: number;
  requiredBidCents: number;
  classifierModel: string | null;
} {
  const complexityScore = lexicalComplexityScore(input.header, input.content);
  const complexityTier = tierFromScore(complexityScore);
  return {
    complexityTier,
    complexityScore,
    requiredBidCents: BID_CENTS_BY_TIER[complexityTier],
    classifierModel: "heuristic"
  };
}

export function formatUsdFromCents(cents: number): string {
  return (Math.max(0, cents) / 100).toFixed(2);
}

export async function classifyQuestionPricing(input: {
  header: string;
  content: string;
}): Promise<{
  complexityTier: ComplexityTier;
  complexityScore: number;
  requiredBidCents: number;
  classifierModel: string | null;
}> {
  const apiKey = (process.env.OPENAI_API_KEY ?? "").trim();
  const model = (process.env.BID_CLASSIFIER_MODEL ?? "gpt-4o-mini").trim();
  const baseUrl = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").trim();
  const heuristicScore = lexicalComplexityScore(input.header, input.content);
  const timeoutMs = readPositiveIntEnv("BID_CLASSIFIER_TIMEOUT_MS", DEFAULT_CLASSIFIER_TIMEOUT_MS);
  const maxCompletionTokens = readPositiveIntEnv("BID_CLASSIFIER_MAX_COMPLETION_TOKENS", DEFAULT_CLASSIFIER_MAX_COMPLETION_TOKENS);
  const isOpenRouter = /openrouter\.ai/i.test(baseUrl);

  if (!apiKey) {
    return fallbackClassification(input);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const body: Record<string, unknown> = {
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      max_tokens: maxCompletionTokens,
      messages: [
        {
          role: "system",
          content:
            [
              "You classify question complexity for marketplace pricing.",
              "Return strict JSON only with keys: tier, score.",
              "tier must be one of simple|medium|complex.",
              "score must be integer 1..5.",
              "Use this rubric:",
              "- simple (1-2): direct factual query, little reasoning/tooling.",
              "- medium (3): moderate reasoning and synthesis.",
              "- complex (4-5): multi-step analysis, system design, deep debugging, or heavy synthesis."
            ].join(" ")
        },
        {
          role: "user",
          content: [
            "Rate this question using:",
            "- simple: factual/straightforward, little reasoning",
            "- medium: moderate reasoning, maybe one tool lookup",
            "- complex: multi-step reasoning, synthesis, likely multiple tool calls",
            "",
            `header: ${input.header}`,
            `content: ${input.content}`
          ].join("\n")
        }
      ]
    };
    if (isOpenRouter) {
      body.max_completion_tokens = maxCompletionTokens;
      body.reasoning = { effort: "low" };
    }

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      return fallbackClassification(input);
    }

    const data = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: unknown;
          reasoning?: unknown;
        };
      }>;
    };

    const primaryText = extractTextPayload(data.choices?.[0]?.message?.content);
    const reasoningText = extractTextPayload(data.choices?.[0]?.message?.reasoning);
    const rawText = String(primaryText || reasoningText || "").trim();
    const rawJson = extractFirstJsonObject(rawText);
    if (!rawJson) {
      return fallbackClassification(input);
    }

    const parsed = JSON.parse(rawJson) as { tier?: string; score?: number };
    const llmTier = normalizeTier(String(parsed.tier ?? DEFAULT_TIER));
    const llmScoreFromTier = tierToScoreCenter(llmTier);
    const llmScore = clampScore(Number(parsed.score ?? llmScoreFromTier));

    const drift = Math.abs(llmScore - heuristicScore);
    const mergedScore = clampScore(drift >= 3 ? Math.round((llmScore + heuristicScore) / 2) : llmScore);
    const complexityScore = mergedScore;
    const complexityTier = tierFromScore(mergedScore);

    return {
      complexityTier,
      complexityScore,
      requiredBidCents: BID_CENTS_BY_TIER[complexityTier],
      classifierModel: model
    };
  } catch {
    return fallbackClassification(input);
  }
}
