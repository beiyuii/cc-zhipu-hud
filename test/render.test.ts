import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { render } from "../dist/statusline.js";

// Helper to strip ANSI escape codes for easier assertions
function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

describe("render", () => {
  it("returns empty string for invalid JSON", () => {
    assert.equal(render("not json"), "");
    assert.equal(render(""), "");
    assert.equal(render("{broken"), "");
  });

  it("returns empty string for empty input", () => {
    assert.equal(render(""), "");
  });

  it("renders dual-line output with model badge and context bar", () => {
    const input = JSON.stringify({
      cost: { total_cost_usd: 2.42 },
      model: { display_name: "Opus 4.6" },
      context_window: { used_percentage: 45 },
    });
    const output = render(input);
    const plain = stripAnsi(output);

    // Should have 2 lines (newline separator)
    const lines = plain.split("\n").filter(l => l.trim());
    assert.equal(lines.length, 2, "should have 2 lines");

    // Line 1: Model badge
    assert.ok(plain.includes("Opus 4.6"), `should include model, got: ${plain}`);

    // Line 2: Context bar and percentage
    assert.ok(plain.includes("Context"), `should include Context label, got: ${plain}`);
    assert.ok(plain.includes("45%"), `should include context %, got: ${plain}`);
    // Progress bar uses █ and ░ characters
    assert.ok(/[█░]+/.test(plain), `should include progress bar, got: ${plain}`);
  });

  it("handles zero cost (shows period cost from cache)", () => {
    const input = JSON.stringify({
      cost: { total_cost_usd: 0 },
      model: { display_name: "Sonnet 4.5" },
      context_window: { used_percentage: 0 },
    });
    const output = render(input);
    const plain = stripAnsi(output);

    // New format shows period cost from cache, not session cost
    // Should include "7d:" or "30d:" prefix
    assert.ok(
      plain.includes("7d:") || plain.includes("30d:"),
      `should show period cost from cache, got: ${plain}`
    );
    assert.ok(plain.includes("0%"), `should show 0%, got: ${plain}`);
  });

  it("handles missing fields gracefully", () => {
    const input = JSON.stringify({});
    const output = render(input);
    const plain = stripAnsi(output);

    // Should use defaults: model="—", context=0%
    assert.ok(plain.includes("—"), `should default model to —, got: ${plain}`);
    assert.ok(plain.includes("0%"), `should default context to 0%, got: ${plain}`);
    // Should include period cost from cache
    assert.ok(
      plain.includes("7d:") || plain.includes("30d:"),
      `should show period cost, got: ${plain}`
    );
  });

  it("counts tokens from transcript", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "cc-render-test-"));
    try {
      const transcriptPath = join(tmpDir, "session.jsonl");
      const lines = [
        JSON.stringify({
          type: "assistant",
          message: { usage: { input_tokens: 5000, output_tokens: 2000 } },
        }),
        JSON.stringify({
          type: "assistant",
          message: { usage: { input_tokens: 3000, output_tokens: 1000 } },
        }),
        JSON.stringify({ type: "user", message: { content: "hello" } }),
      ].join("\n");
      writeFileSync(transcriptPath, lines + "\n");

      const input = JSON.stringify({
        cost: { total_cost_usd: 1.5 },
        model: { display_name: "Sonnet 4.5" },
        context_window: { used_percentage: 25 },
        transcript_path: transcriptPath,
      });
      const output = render(input);
      const plain = stripAnsi(output);

      // New format focuses on context bar and cost, not token count in display
      assert.ok(plain.includes("Sonnet 4.5"), `should include model, got: ${plain}`);
      assert.ok(plain.includes("25%"), `should show 25% context, got: ${plain}`);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("handles large period cost values", () => {
    const input = JSON.stringify({
      cost: { total_cost_usd: 1234.56 },
      model: { display_name: "Opus 4.6" },
      context_window: { used_percentage: 95 },
    });
    const output = render(input);
    const plain = stripAnsi(output);

    assert.ok(plain.includes("95%"), `should show 95%, got: ${plain}`);
  });

  it("handles high context percentage with correct color", () => {
    const input = JSON.stringify({
      cost: { total_cost_usd: 1 },
      model: { display_name: "Sonnet 4.5" },
      context_window: { used_percentage: 85 },
    });
    const output = render(input);

    // Red color for >= 80%
    assert.ok(output.includes("\x1b[38;5;167m"), "should use red for high context");
  });

  it("output starts with a space and has newline separator", () => {
    const input = JSON.stringify({
      cost: { total_cost_usd: 0 },
      model: { display_name: "Test" },
      context_window: { used_percentage: 0 },
    });
    const output = render(input);
    assert.ok(output.startsWith(" "), "output should start with a leading space");
    assert.ok(output.includes("\n"), "output should have newline (dual-line)");
  });

  it("shows git status when available", () => {
    const input = JSON.stringify({
      cost: { total_cost_usd: 0 },
      model: { display_name: "Test" },
      context_window: { used_percentage: 0 },
    });
    const output = render(input);
    const plain = stripAnsi(output);

    // Should include git: with branch name
    assert.ok(plain.includes("git:"), `should include git status, got: ${plain}`);
  });

  it("includes project path", () => {
    const input = JSON.stringify({
      cost: { total_cost_usd: 0 },
      model: { display_name: "Test" },
      context_window: { used_percentage: 0 },
    });
    const output = render(input);
    const plain = stripAnsi(output);

    // Should include current directory name
    const cwd = process.cwd().split("/").pop();
    assert.ok(plain.includes(cwd || "."), `should include project path, got: ${plain}`);
  });

  it("includes separator │ between sections", () => {
    const input = JSON.stringify({
      cost: { total_cost_usd: 0 },
      model: { display_name: "Test" },
      context_window: { used_percentage: 0 },
    });
    const output = render(input);
    const plain = stripAnsi(output);

    // Should include │ separator (without ANSI codes it shows as a character)
    assert.ok(plain.includes("│"), `should include │ separator, got: ${plain}`);
  });
});
