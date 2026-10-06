import "server-only";

// Cliente mínimo de OpenRouter (API compatible con OpenAI). Solo corre en el
// servidor: la clave nunca llega al navegador.

export const AI_MODEL = process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4.5";
const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export function aiEnabled(): boolean {
  return !!process.env.OPENROUTER_API_KEY;
}

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ToolDefinition {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export class AiError extends Error {}

/** Mensaje claro para la persona según lo que respondió OpenRouter. */
export function describeHttpError(status: number): string {
  if (status === 401 || status === 403) return "La clave de OpenRouter no es válida. Revisá OPENROUTER_API_KEY.";
  if (status === 402) return "La cuenta de OpenRouter no tiene saldo suficiente.";
  if (status === 429) return "La IA recibió demasiadas consultas. Probá de nuevo en un momento.";
  if (status === 400 || status === 404) return `El modelo configurado (${AI_MODEL}) no está disponible. Revisá OPENROUTER_MODEL.`;
  return "La IA no respondió. Probá de nuevo en un momento.";
}

export async function chat(params: {
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  maxTokens?: number;
  temperature?: number;
}): Promise<{ content: string | null; toolCalls: ToolCall[] }> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new AiError("La IA no está activada: falta OPENROUTER_API_KEY.");

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        // Opcionales de OpenRouter: identifican la app en su panel
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
        "X-Title": "Kairos PSA",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: params.messages,
        tools: params.tools?.length ? params.tools : undefined,
        max_tokens: params.maxTokens ?? 900,
        temperature: params.temperature ?? 0.2,
      }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch {
    throw new AiError("No se pudo conectar con la IA. Revisá tu conexión y probá de nuevo.");
  }
  if (!res.ok) throw new AiError(describeHttpError(res.status));

  const data = (await res.json()) as { choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[] };
  const message = data.choices?.[0]?.message;
  if (!message) throw new AiError("La IA devolvió una respuesta vacía.");
  return { content: message.content ?? null, toolCalls: message.tool_calls ?? [] };
}
