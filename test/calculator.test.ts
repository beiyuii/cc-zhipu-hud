import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getPricing, calculateCost } from "../dist/calculator.js";

describe("getPricing", () => {
  it("returns exact pricing for known models", () => {
    const opus = getPricing("claude-opus-4-6");
    assert.equal(opus.input, 5);
    assert.equal(opus.output, 25);
    assert.equal(opus.cacheCreation, 6.25);
    assert.equal(opus.cacheRead, 0.5);
  });

  it("falls back to family pricing for unknown opus model", () => {
    const pricing = getPricing("claude-opus-99-unknown");
    assert.equal(pricing.input, 5);
    assert.equal(pricing.output, 25);
  });

  it("falls back to family pricing for unknown sonnet model", () => {
    const pricing = getPricing("claude-sonnet-99-unknown");
    assert.equal(pricing.input, 3);
    assert.equal(pricing.output, 15);
  });

  it("falls back to family pricing for unknown haiku model", () => {
    const pricing = getPricing("claude-haiku-99-unknown");
    assert.equal(pricing.input, 1);
    assert.equal(pricing.output, 5);
  });

  it("defaults to sonnet pricing for completely unknown model", () => {
    const pricing = getPricing("totally-unknown-model");
    assert.equal(pricing.input, 3);
    assert.equal(pricing.output, 15);
  });
});

describe("calculateCost", () => {
  it("calculates cost for opus model", () => {
    // 1M input + 1M output = $5 + $25 = $30
    const cost = calculateCost("claude-opus-4-6", 1_000_000, 1_000_000, 0, 0);
    assert.equal(cost, 30);
  });

  it("calculates cost with cache tokens", () => {
    // 0 input + 0 output + 1M cache write + 1M cache read = $6.25 + $0.5 = $6.75
    const cost = calculateCost("claude-opus-4-6", 0, 0, 1_000_000, 1_000_000);
    assert.equal(cost, 6.75);
  });

  it("calculates cost for typical session", () => {
    // 50k input + 10k output on opus: (50000*5 + 10000*25) / 1e6 = 0.25 + 0.25 = 0.5
    const cost = calculateCost("claude-opus-4-6", 50_000, 10_000, 0, 0);
    assert.ok(Math.abs(cost - 0.5) < 0.001, `expected ~0.5, got ${cost}`);
  });

  it("returns 0 for zero tokens", () => {
    assert.equal(calculateCost("claude-opus-4-6", 0, 0, 0, 0), 0);
  });
});
