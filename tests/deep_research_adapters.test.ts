import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isRecord,
  hasArray,
  safeString,
  decodeBase64,
  filePriority,
  architectureHints,
  type GitHubApiRepoItem,
} from "../src/lib/factory/deep-research-v12/github";
import {
  needsModelResearch,
  sourceProofSignals,
  type HuggingFaceModelItem,
  type GitLabProjectItem,
  type TavilySearchResultItem,
  type GitHubReleaseItem,
} from "../src/lib/factory/deep-research-v12/github-adapters";
import type { ResearchProfileV12, DeepResearchSignalV12 } from "../src/lib/factory/deep-research-v12/types";

describe("Deep Research Boundary Guards & Normalizers", () => {
  it("isRecord correctly identifies records vs primitives and arrays", () => {
    assert.strictEqual(isRecord({ key: "val" }), true);
    assert.strictEqual(isRecord({}), true);
    assert.strictEqual(isRecord([]), false);
    assert.strictEqual(isRecord(null), false);
    assert.strictEqual(isRecord(undefined), false);
    assert.strictEqual(isRecord("string"), false);
    assert.strictEqual(isRecord(123), false);
  });

  it("hasArray identifies presence of array properties", () => {
    assert.strictEqual(hasArray({ items: [1, 2] }, "items"), true);
    assert.strictEqual(hasArray({ items: [] }, "items"), true);
    assert.strictEqual(hasArray({ items: "not-an-array" }, "items"), false);
    assert.strictEqual(hasArray({}, "items"), false);
    assert.strictEqual(hasArray(null, "items"), false);
  });

  it("safeString extracts string or returns fallback", () => {
    assert.strictEqual(safeString("valid"), "valid");
    assert.strictEqual(safeString(123, "fallback"), "fallback");
    assert.strictEqual(safeString(null, "fallback"), "fallback");
    assert.strictEqual(safeString(undefined), "");
  });

  it("decodeBase64 decodes safely and handles malformed non-string inputs", () => {
    const encoded = Buffer.from("Hello World", "utf8").toString("base64");
    assert.strictEqual(decodeBase64(encoded), "Hello World");
    assert.strictEqual(decodeBase64(null), "");
    assert.strictEqual(decodeBase64(12345), "");
    assert.strictEqual(decodeBase64({}), "");
  });
});

describe("Deep Research Priority & Hint Logic", () => {
  const dummyProfile: ResearchProfileV12 = {
    query: "agent orchestrator",
    domain: "Developer Tools",
    productArchetype: "agent orchestrator",
    domainTerms: ["agent", "mcp", "workflow"],
    intentTerms: ["autonomous", "build"],
    capabilities: ["Agent architecture"],
    genericCapabilities: [],
    specializedCapabilities: ["Agent architecture"],
    queries: [],
  };

  it("filePriority down-ranks vendor and binary assets and boosts architecture assets", () => {
    assert.ok(filePriority("node_modules/package/index.js", dummyProfile) <= -100);
    assert.ok(filePriority("dist/bundle.min.js", dummyProfile) <= -100);
    assert.ok(filePriority("logo.png", dummyProfile) <= -100);

    const docScore = filePriority("docs/architecture.md", dummyProfile);
    const srcScore = filePriority("src/agent/executor.ts", dummyProfile);
    assert.ok(docScore > 10);
    assert.ok(srcScore > 10);
  });

  it("architectureHints extracts architectural layers from file lists", () => {
    const hints = architectureHints(
      ["Dockerfile", "docker-compose.yml", "src/agent/planner.ts", "tests/e2e.spec.ts"],
      "agent system with docker and playwright"
    );
    assert.ok(hints.includes("Containerized deployment assets detected"));
    assert.ok(hints.includes("Agent/tool architecture detected"));
    assert.ok(hints.includes("Automated test assets detected"));
  });
});

describe("GitHub Adapters & Proof Signals", () => {
  it("needsModelResearch detects AI/LLM capability requirements", () => {
    const aiProfile: ResearchProfileV12 = {
      query: "coding agent",
      domain: "AI",
      productArchetype: "coding agent",
      domainTerms: [],
      intentTerms: [],
      capabilities: ["LLM code generation", "RAG memory"],
      genericCapabilities: [],
      specializedCapabilities: [],
      queries: [],
    };
    assert.strictEqual(needsModelResearch(aiProfile), true);

    const nonAiProfile: ResearchProfileV12 = {
      query: "cli calculator",
      domain: "Utilities",
      productArchetype: "cli calculator",
      domainTerms: [],
      intentTerms: [],
      capabilities: ["math parser"],
      genericCapabilities: [],
      specializedCapabilities: [],
      queries: [],
    };
    assert.strictEqual(needsModelResearch(nonAiProfile), false);
  });


  it("sourceProofSignals handles missing inspection gracefully", () => {
    const signalWithoutInspection: DeepResearchSignalV12 = {
      source: "GitHub",
      kind: "github-repository",
      title: "test-repo",
      url: "https://github.com/test/test-repo",
      summary: "test summary",
      relevance: 0.85,
      capabilities: ["Agent architecture"],
      metrics: {},
    };

    const proof = sourceProofSignals(signalWithoutInspection);
    assert.deepStrictEqual(proof, []);
  });

  it("sourceProofSignals maps sourceLinks to inspection signals", () => {
    const signalWithInspection: DeepResearchSignalV12 = {
      source: "GitHub",
      kind: "github-repository",
      title: "test-repo",
      url: "https://github.com/test/test-repo",
      summary: "test summary",
      relevance: 0.85,
      capabilities: ["Agent architecture"],
      metrics: {},
      inspection: {
        inspected: true,
        depth: "code-sample",
        defaultBranch: "main",
        filesSeen: 10,
        sourceFilesSampled: 2,
        readmeCharacters: 1500,
        inspectionScore: 88,
        verifiedCapabilities: ["Agent architecture"],
        specializedCapabilities: ["Agent architecture"],
        architectureHints: [],
        keyFiles: [],
        sourceLinks: [
          { label: "repo", url: "https://github.com/test/test-repo", kind: "repository" },
          { label: "README", url: "https://github.com/test/test-repo/blob/main/README.md", kind: "readme" },
          { label: "src/agent.ts", url: "https://github.com/test/test-repo/blob/main/src/agent.ts", kind: "source-file" },
        ],
        warnings: [],
      },
    };

    const proofs = sourceProofSignals(signalWithInspection);
    assert.strictEqual(proofs.length, 2);
    assert.strictEqual(proofs[0].source, "GitHub README");
    assert.strictEqual(proofs[1].source, "GitHub source proof");
  });
});
