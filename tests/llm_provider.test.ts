import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  LLMProviderError,
  telemetry,
  llmCache,
  cosineSimilarity,
  type LLMResponse,
  type LLMToolCall,
  type ProviderMetrics,
  type ProviderSummaryRecord,
} from "../src/llm/provider";

describe("LLMProviderError Model", () => {
  it("creates error with provider, status, and message", () => {
    const error = new LLMProviderError("Authentication failed", {
      status: 401,
      provider: "openai",
      details: { code: "invalid_api_key" },
    });

    assert.ok(error instanceof Error);
    assert.ok(error instanceof LLMProviderError);
    assert.strictEqual(error.name, "LLMProviderError");
    assert.strictEqual(error.message, "Authentication failed");
    assert.strictEqual(error.status, 401);
    assert.strictEqual(error.provider, "openai");
    assert.deepStrictEqual(error.details, { code: "invalid_api_key" });
  });

  it("handles empty options gracefully", () => {
    const error = new LLMProviderError("Generic failure");
    assert.strictEqual(error.status, undefined);
    assert.strictEqual(error.provider, undefined);
    assert.strictEqual(error.details, undefined);
  });
});

describe("Telemetry Contracts", () => {
  beforeEach(() => {
    telemetry.record("openai", true, 120, false);
    telemetry.record("openai", true, 80, false);
    telemetry.record("openai", false, undefined, false);
    telemetry.record("anthropic", true, 200, true);
  });

  it("getMetrics returns strongly typed ProviderMetrics records", () => {
    const metrics = telemetry.getMetrics();
    assert.strictEqual(typeof metrics, "object");

    const openai = metrics["openai"];
    assert.ok(openai !== undefined);
    assert.strictEqual(typeof openai.attempts, "number");
    assert.strictEqual(typeof openai.success, "number");
    assert.strictEqual(typeof openai.failure, "number");
    assert.strictEqual(typeof openai.successRate, "number");
    assert.strictEqual(typeof openai.healthScore, "number");
    assert.ok(openai.attempts >= 3);

    // Verify type contract consistency
    const typedRecord: ProviderMetrics = openai;
    assert.ok(typedRecord.success > 0);
  });

  it("getSummary returns formatted percentage and latencies", () => {
    const summary = telemetry.getSummary();
    assert.strictEqual(typeof summary, "object");

    const openai = summary["openai"];
    assert.ok(openai !== undefined);
    assert.ok(openai.successRate.endsWith("%"));
    assert.strictEqual(typeof openai.fallbacks, "number");

    // Verify type contract consistency
    const typedSummary: ProviderSummaryRecord = openai;
    assert.strictEqual(typeof typedSummary.healthScore, "string");
  });

  it("toPrometheus formats lines with provider labels", () => {
    const prometheus = telemetry.toPrometheus("test_llm");
    assert.ok(prometheus.includes("test_llm_requests_total{provider=\"openai\"}"));
    assert.ok(prometheus.includes("test_llm_success_total{provider=\"openai\"}"));
    assert.ok(prometheus.includes("test_llm_health_score{provider=\"openai\"}"));
  });
});

describe("LLM Tool Call & Response Types", () => {
  it("LLMResponse supports structured toolCalls array", () => {
    const toolCall: LLMToolCall = {
      id: "call_123",
      type: "function",
      function: {
        name: "search_web",
        arguments: JSON.stringify({ query: "AI factory" }),
      },
    };

    const response: LLMResponse = {
      text: "Searching web...",
      usage: { promptTokens: 10, completionTokens: 5 },
      model: "gpt-4o-mini",
      provider: "openai",
      costEstimate: 0.0001,
      latency: 150,
      toolCalls: [toolCall],
    };

    assert.strictEqual(response.toolCalls?.length, 1);
    assert.strictEqual(response.toolCalls?.[0].function?.name, "search_web");
  });
});

describe("Cosine Similarity & Cache Key", () => {
  it("cosineSimilarity returns 1 for identical normalized vectors", () => {
    const vecA = [0.5, 0.5, 0.5, 0.5];
    const vecB = [0.5, 0.5, 0.5, 0.5];
    assert.ok(Math.abs(cosineSimilarity(vecA, vecB) - 1) < 1e-5);
  });

  it("cosineSimilarity returns 0 for orthogonal vectors", () => {
    const vecA = [1, 0];
    const vecB = [0, 1];
    assert.strictEqual(cosineSimilarity(vecA, vecB), 0);
  });

  it("cache generates deterministic keys", () => {
    const key1 = llmCache.generateKey([{ role: "user", content: "hello world" }]);
    const key2 = llmCache.generateKey([{ role: "user", content: "hello world" }]);
    assert.strictEqual(key1, key2);
    assert.strictEqual(typeof key1, "string");
    assert.strictEqual(key1.length, 64); // SHA-256 hex
  });
});
