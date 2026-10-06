import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const load = async () => import("./openrouter");

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("cliente de OpenRouter", () => {
  it("sin clave, la IA está desactivada y no llama a la red", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { aiEnabled, chat } = await load();
    expect(aiEnabled()).toBe(false);
    await expect(chat({ messages: [{ role: "user", content: "hola" }] })).rejects.toThrow(/falta OPENROUTER_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("manda la clave en el header y devuelve el texto y las herramientas pedidas", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "sk-test");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: "Hola", tool_calls: [{ id: "1", type: "function", function: { name: "f", arguments: "{}" } }] } }] }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { chat } = await load();
    const r = await chat({ messages: [{ role: "user", content: "hola" }] });
    expect(r).toEqual({ content: "Hola", toolCalls: [{ id: "1", type: "function", function: { name: "f", arguments: "{}" } }] });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer sk-test");
    expect(JSON.parse(init.body).messages).toEqual([{ role: "user", content: "hola" }]);
  });

  it("traduce los errores HTTP a mensajes claros", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "sk-test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 402 })));
    const { chat, describeHttpError } = await load();
    await expect(chat({ messages: [{ role: "user", content: "x" }] })).rejects.toThrow("La cuenta de OpenRouter no tiene saldo suficiente.");
    expect(describeHttpError(401)).toMatch(/clave/);
    expect(describeHttpError(429)).toMatch(/demasiadas/);
  });
});
