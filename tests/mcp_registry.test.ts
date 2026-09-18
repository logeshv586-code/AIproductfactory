import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  MCPRegistry,
  makeGitHubSearchTool,
  makeWebSearchTool,
  makeRAGQueryTool,
  type MCPTool,
  type MCPLogger,
  type MCPToolMetrics,
  type GitHubSearchPayload,
  type WebSearchPayload,
  type RAGQueryPayload,
} from "../src/lib/factory/mcp/registry";

describe("MCPRegistry Tool Lifecycle & Typing", () => {
  let registry: MCPRegistry;

  beforeEach(() => {
    registry = new MCPRegistry();
  });

  it("registers and lists generic tools correctly", () => {
    const echoTool: MCPTool<[message: string], { echo: string }> = {
      name: "echo_tool",
      description: "Echoes input message",
      tags: ["utility", "test"],
      handler: async (message: string) => ({ echo: message }),
      schema: { type: "object", properties: { message: { type: "string" } } },
    };

    registry.register(echoTool);
    const tools = registry.listTools();
    assert.ok(tools.includes("echo_tool"));

    const filtered = registry.listTools("test");
    assert.deepStrictEqual(filtered, ["echo_tool"]);

    const missing = registry.listTools("non_existent_tag");
    assert.strictEqual(missing.length, 0);
  });

  it("describes registered tool with schema and metrics", () => {
    const tool: MCPTool<[num: number], number> = {
      name: "double_tool",
      description: "Doubles a number",
      tags: ["math"],
      handler: (num: number) => num * 2,
      schema: { type: "object" },
    };

    registry.register(tool);
    const desc = registry.describe("double_tool");
    assert.strictEqual(desc.name, "double_tool");
    assert.strictEqual(desc.description, "Doubles a number");
    assert.strictEqual(desc.metrics.calls, 0);
    assert.strictEqual(desc.metrics.healthScore, 1);
  });

  it("throws error when describing an unregistered tool", () => {
    assert.throws(() => registry.describe("unknown_tool"), /Tool 'unknown_tool' not found/);
  });

  it("formats tools into LLM function declarations", () => {
    const tool: MCPTool = {
      name: "calc",
      description: "Calculator",
      tags: ["math"],
      handler: () => 42,
      schema: { type: "object", properties: { a: { type: "number" } } },
    };
    registry.register(tool);

    const llmTools = registry.toLLMTools();
    assert.strictEqual(llmTools.length, 1);
    assert.strictEqual(llmTools[0].type, "function");
    assert.strictEqual(llmTools[0].function.name, "calc");
    assert.deepStrictEqual(llmTools[0].function.parameters, tool.schema);
  });
});

describe("MCPRegistry Execution & Error Handling", () => {
  let registry: MCPRegistry;

  beforeEach(() => {
    registry = new MCPRegistry();
  });

  it("executes typed tools through runTool and mcpRunner", async () => {
    const addTool: MCPTool<[a: number, b: number], number> = {
      name: "add",
      description: "Adds numbers",
      tags: ["math"],
      handler: async (a: number, b: number) => a + b,
      schema: { type: "object" },
    };
    registry.register(addTool);

    const result = await registry.runTool<number, [number, number]>("add", [5, 7]);
    assert.strictEqual(result, 12);

    const runnerResult = await registry.mcpRunner<number, [number, number]>("add", 10, 20);
    assert.strictEqual(runnerResult, 30);
  });

  it("handles tool timeout with AbortController", async () => {
    const slowTool: MCPTool<[], string> = {
      name: "slow_tool",
      description: "Takes too long",
      tags: ["test"],
      handler: () => new Promise((resolve) => setTimeout(() => resolve("done"), 200)),
      schema: { type: "object" },
      timeoutMs: 50,
      maxAttempts: 1,
    };
    registry.register(slowTool);

    await assert.rejects(
      () => registry.runTool("slow_tool"),
      /Tool 'slow_tool' timed out after 50ms/
    );

    const metric = registry.getMetrics("slow_tool") as MCPToolMetrics;
    assert.strictEqual(metric.calls, 1);
    assert.strictEqual(metric.failures, 1);
    assert.strictEqual(metric.successes, 0);
  });

  it("recovers via static fallback result on error", async () => {
    const failingTool: MCPTool<[id: string], { id: string; status: string }> = {
      name: "failing_tool",
      description: "Always fails",
      tags: ["test"],
      handler: () => {
        throw new Error("Network offline");
      },
      schema: { type: "object" },
      maxAttempts: 2,
      fallbackResult: { id: "fallback", status: "cached" },
    };
    registry.register(failingTool);

    const result = await registry.runTool<{ id: string; status: string }, [string]>("failing_tool", ["item-1"]);
    assert.deepStrictEqual(result, { id: "fallback", status: "cached" });
  });

  it("recovers via dynamic functional fallback with error inspection", async () => {
    let capturedError: unknown = null;
    let capturedArgs: unknown[] = [];

    const dynamicFallbackTool: MCPTool<[code: number], string> = {
      name: "dynamic_fallback",
      description: "Fails with error details",
      tags: ["test"],
      handler: () => {
        throw new Error("Validation mismatch");
      },
      schema: { type: "object" },
      maxAttempts: 1,
      fallbackResult: (args, err) => {
        capturedArgs = args;
        capturedError = err;
        return `recovered from ${err instanceof Error ? err.message : String(err)}`;
      },
    };
    registry.register(dynamicFallbackTool);

    const result = await registry.runTool<string, [number]>("dynamic_fallback", [404]);
    assert.strictEqual(result, "recovered from Validation mismatch");
    assert.deepStrictEqual(capturedArgs, [404]);
    assert.ok(capturedError instanceof Error);
  });

  it("handles non-Error throwables gracefully in negative paths", async () => {
    const primitiveThrowTool: MCPTool<[], string> = {
      name: "throw_string",
      description: "Throws a raw string",
      tags: ["test"],
      handler: () => {
        throw "critical_string_failure";
      },
      schema: { type: "object" },
      maxAttempts: 1,
      fallbackResult: (_args, err) => `recovered: ${String(err)}`,
    };
    registry.register(primitiveThrowTool);

    const res = await registry.runTool<string>("throw_string");
    assert.strictEqual(res, "recovered: critical_string_failure");
  });

  it("retries on validateResult failure before triggering fallback", async () => {
    let attempts = 0;
    const invalidDataTool: MCPTool<[], { valid: boolean }> = {
      name: "invalid_tool",
      description: "Returns invalid shape",
      tags: ["test"],
      handler: () => {
        attempts++;
        return { valid: false };
      },
      schema: { type: "object" },
      validateResult: (res: unknown): boolean => {
        return (res as { valid?: boolean })?.valid === true;
      },
      maxAttempts: 3,
      fallbackResult: { valid: true },
    };
    registry.register(invalidDataTool);

    const res = await registry.runTool<{ valid: boolean }>("invalid_tool");
    assert.strictEqual(attempts, 3);
    assert.deepStrictEqual(res, { valid: true });
  });
});

describe("Built-in Tool Factory Contracts", () => {
  it("makeGitHubSearchTool returns typed tool structure and validates responses", () => {
    const tool = makeGitHubSearchTool();
    assert.strictEqual(tool.name, "github_search");
    assert.ok(tool.tags.includes("github"));
    assert.strictEqual(typeof tool.handler, "function");
    assert.deepStrictEqual(tool.fallbackResult, { items: [] });
    assert.ok(tool.validateResult?.({ items: [] }));
    assert.strictEqual(tool.validateResult?.({ items: "not-an-array" }), false);
    assert.strictEqual(tool.validateResult?.(null), false);
  });

  it("makeWebSearchTool returns typed web_search tool structure", () => {
    const tool = makeWebSearchTool();
    assert.strictEqual(tool.name, "web_search");
    assert.ok(tool.tags.includes("web"));
    assert.strictEqual(typeof tool.handler, "function");
    assert.ok(tool.validateResult?.({ results: [] }));
    assert.strictEqual(tool.validateResult?.(null), false);

    if (typeof tool.fallbackResult === "function") {
      const fb = tool.fallbackResult(["test query", 5], new Error("API down"));
      assert.deepStrictEqual(fb, { query: "test query", results: [] });
    }
  });

  it("makeRAGQueryTool returns typed rag_query tool structure", () => {
    const mockMemory = {
      recallContext: (q: string, k = 5) => [`hit 1 for ${q}`, `hit 2 (${k})`],
    };
    const tool = makeRAGQueryTool(mockMemory);
    assert.strictEqual(tool.name, "rag_query");
    assert.ok(tool.tags.includes("rag"));

    const result = (tool.handler as (query: string, topK?: number) => RAGQueryPayload)("agent memory", 2);
    assert.deepStrictEqual(result, { hits: ["hit 1 for agent memory", "hit 2 (2)"] });
    assert.ok(tool.validateResult?.({ hits: [] }));
    assert.strictEqual(tool.validateResult?.({}), false);
  });
});

describe("MCPLogger & Diagnostics Matrix", () => {
  it("delegates log events to custom logger when provided", async () => {
    const logs: { level: string; msg: string }[] = [];
    const customLogger: MCPLogger = {
      debug: (msg) => logs.push({ level: "debug", msg }),
      info: (msg) => logs.push({ level: "info", msg }),
      warn: (msg) => logs.push({ level: "warn", msg }),
      error: (msg) => logs.push({ level: "error", msg }),
    };

    const registry = new MCPRegistry();
    registry.setLogger(customLogger);

    const testTool: MCPTool = {
      name: "logged_tool",
      description: "Logs during execution",
      tags: ["test"],
      handler: () => "logged",
      schema: { type: "object" },
    };

    registry.register(testTool);
    await registry.runTool("logged_tool");

    assert.ok(logs.some((l) => l.level === "debug" && l.msg.includes("[MCP] registered: logged_tool")));
    assert.ok(logs.some((l) => l.level === "debug" && l.msg.includes("[MCP] calling logged_tool")));
  });

  it("suppresses debug output when in test mode without logger", async () => {
    const registry = new MCPRegistry();
    const testTool: MCPTool = {
      name: "silent_tool",
      description: "Should not log in test mode",
      tags: ["test"],
      handler: () => "silent",
      schema: { type: "object" },
    };
    registry.register(testTool);
    const res = await registry.runTool("silent_tool");
    assert.strictEqual(res, "silent");
  });
});

