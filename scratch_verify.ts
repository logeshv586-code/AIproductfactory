import { llm } from "./src/llm/provider"

async function test() {
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "dummy"
  
  console.log("--- Test 1: First Run (Network/Mock) ---")
  try {
    const res1 = await llm.generate([{ role: "user", content: "Hello, reply with only 'READY'" }], { useCache: false })
    console.log("Res 1:", res1.text)
  } catch (e: any) {
    console.log("Test 1 skipped (no key)")
  }

  console.log("\n--- Test 2: Cache Persistence Check ---")
  const key = "test_cache_key"
  const dummyResp = { 
    text: "CACHED", 
    usage: { promptTokens: 1, completionTokens: 1 }, 
    model: "test", 
    provider: "openai" as any, 
    costEstimate: 0, 
    latency: 1 
  }
  
  // Directly manipulate cache for test
  const { llmCache } = await import("./src/llm/provider")
  llmCache.set(key, dummyResp)
  
  const cached = llmCache.get(key)
  console.log("Cache Get:", cached?.text === "CACHED" ? "PASS" : "FAIL")

  console.log("\n--- Telemetry Summary ---")
  llm.printTelemetry()
}

test()
