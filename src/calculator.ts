interface ModelPricing {
  input: number;
  output: number;
  cacheCreation: number;
  cacheRead: number;
}

// Per-million-token pricing in USD (source: Anthropic pricing page)
const MODEL_PRICING: Record<string, ModelPricing> = {
  // Opus family
  "claude-opus-4-6":            { input: 5,   output: 25,  cacheCreation: 6.25,  cacheRead: 0.5  },
  "claude-opus-4-5-20251101":   { input: 5,   output: 25,  cacheCreation: 6.25,  cacheRead: 0.5  },
  "claude-opus-4-1-20250805":   { input: 15,  output: 75,  cacheCreation: 18.75, cacheRead: 1.5  },

  // Sonnet family
  "claude-sonnet-4-5-20250929": { input: 3,   output: 15,  cacheCreation: 3.75,  cacheRead: 0.3  },
  "claude-sonnet-4-20250514":   { input: 3,   output: 15,  cacheCreation: 3.75,  cacheRead: 0.3  },
  "claude-3-5-sonnet-20241022": { input: 3,   output: 15,  cacheCreation: 3.75,  cacheRead: 0.3  },

  // Haiku family
  "claude-haiku-4-5-20251001":  { input: 1,   output: 5,   cacheCreation: 1.25,  cacheRead: 0.1  },
  "claude-3-5-haiku-20241022":  { input: 0.8, output: 4,   cacheCreation: 1,     cacheRead: 0.08 },
};

// Family fallbacks for unknown model IDs
const FAMILY_FALLBACK: Record<string, ModelPricing> = {
  opus:   MODEL_PRICING["claude-opus-4-6"],
  sonnet: MODEL_PRICING["claude-sonnet-4-5-20250929"],
  haiku:  MODEL_PRICING["claude-haiku-4-5-20251001"],
};

export function getPricing(model: string): ModelPricing {
  if (MODEL_PRICING[model]) return MODEL_PRICING[model];

  // Try family fallback
  const lower = model.toLowerCase();
  for (const [family, pricing] of Object.entries(FAMILY_FALLBACK)) {
    if (lower.includes(family)) return pricing;
  }

  // Default to sonnet pricing
  return FAMILY_FALLBACK.sonnet;
}

export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheCreationTokens: number,
  cacheReadTokens: number,
): number {
  const pricing = getPricing(model);
  return (
    inputTokens * pricing.input +
    outputTokens * pricing.output +
    cacheCreationTokens * pricing.cacheCreation +
    cacheReadTokens * pricing.cacheRead
  ) / 1e6;
}
