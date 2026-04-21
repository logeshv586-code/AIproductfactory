// ============================================================
// LLM Provider Layer
// Pluggable AI abstraction using z-ai-web-dev-sdk
// Supports: OpenAI, Claude, Gemini (via z-ai-web-dev-sdk)
// ============================================================

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMResponse {
  text: string;
  usage?: { promptTokens: number; completionTokens: number };
  model?: string;
}

export interface LLMProvider {
  generate(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse>;
  embed(text: string): Promise<number[]>;
}

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

// Default provider using z-ai-web-dev-sdk
class ZAIProvider implements LLMProvider {
  async generate(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse> {
    try {
      // Dynamic import to avoid SSR issues
      const ZAI = (await import("z-ai-web-dev-sdk")).default;
      const zai = await ZAI.create();

      const completion = await zai.chat.completions.create({
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 2000,
      });

      const content = completion.choices?.[0]?.message?.content || "";
      return {
        text: content,
        usage: {
          promptTokens: completion.usage?.prompt_tokens || 0,
          completionTokens: completion.usage?.completion_tokens || 0,
        },
        model: completion.model,
      };
    } catch (error: any) {
      console.error("ZAI LLM Provider error:", error.message);
      // Fallback to local generation
      return this.localFallback(messages);
    }
  }

  async embed(text: string): Promise<number[]> {
    try {
      const ZAI = (await import("z-ai-web-dev-sdk")).default;
      const zai = await ZAI.create();

      // Use the chat completions to generate embeddings-like representation
      const completion = await zai.chat.completions.create({
        messages: [
          {
            role: "system",
            content:
              "Generate a concise summary of the following text for semantic comparison. Return only the summary.",
          },
          { role: "user", content: text },
        ],
        temperature: 0.1,
        max_tokens: 200,
      });

      const summary = completion.choices?.[0]?.message?.content || text.slice(0, 200);
      return this.textToVector(summary);
    } catch {
      return this.textToVector(text);
    }
  }

  // Simple local vector representation for semantic comparison
  private textToVector(text: string): number[] {
    const dim = 128;
    const vector = new Array(dim).fill(0);
    const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, "");

    for (let i = 0; i < normalized.length; i++) {
      const charCode = normalized.charCodeAt(i);
      const idx = i % dim;
      vector[idx] += charCode / 127;
    }

    // Normalize
    const mag = Math.sqrt(vector.reduce((s, v) => s + v * v, 0)) || 1;
    return vector.map((v) => v / mag);
  }

  private async localFallback(messages: LLMMessage[]): Promise<LLMResponse> {
    const lastUserMsg = messages.filter((m) => m.role === "user").pop();
    return {
      text: `Analysis of: ${lastUserMsg?.content?.slice(0, 100) || "input"}. Local fallback - LLM provider unavailable.`,
      usage: { promptTokens: 0, completionTokens: 0 },
      model: "local-fallback",
    };
  }
}

// Singleton provider instance
let providerInstance: LLMProvider | null = null;

export function getLLMProvider(): LLMProvider {
  if (!providerInstance) {
    providerInstance = new ZAIProvider();
  }
  return providerInstance;
}

export function setLLMProvider(provider: LLMProvider): void {
  providerInstance = provider;
}

// Convenience functions
export async function generate(
  prompt: string,
  systemPrompt?: string,
  options?: LLMOptions
): Promise<string> {
  const provider = getLLMProvider();
  const messages: LLMMessage[] = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: prompt });

  const response = await provider.generate(messages, options);
  return response.text;
}

export async function generateJSON<T = any>(
  prompt: string,
  systemPrompt?: string,
  options?: LLMOptions
): Promise<T> {
  const fullPrompt = `${prompt}\n\nReturn ONLY valid JSON, no markdown formatting, no explanation.`;
  const text = await generate(fullPrompt, systemPrompt, options);

  try {
    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(text);
  } catch {
    throw new Error(`Failed to parse LLM response as JSON: ${text.slice(0, 200)}`);
  }
}

export async function embed(text: string): Promise<number[]> {
  const provider = getLLMProvider();
  return provider.embed(text);
}

// Cosine similarity for vector comparison
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}
