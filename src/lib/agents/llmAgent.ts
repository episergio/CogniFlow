const DEFAULT_MODEL = "gpt-4o-mini";
const TIMEOUT_MS = 8000;

export function isLlmEnabled(): boolean {
  return process.env.AI_PROVIDER === "openai" && !!process.env.OPENAI_API_KEY;
}

/**
 * Enriquecimiento OPCIONAL de la pregunta del GAP mediante LLM.
 * Solo se activa si AI_PROVIDER=openai y existe OPENAI_API_KEY.
 * Ante cualquier error (red, cuota, timeout) cae en la pregunta base
 * generada por el motor de reglas: el sistema nunca depende del LLM.
 */
export async function enrichGapQuestion(
  baseQuestion: string,
  requirement: { externalId: string; name: string; description: string }
): Promise<string> {
  if (!isLlmEnabled()) return baseQuestion;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
        temperature: 0.2,
        max_tokens: 150,
        messages: [
          {
            role: "system",
            content:
              "Sos un analista funcional. Refiná la redacción de la pregunta de un GAP de calidad sobre un requisito. No inventes información de dominio: solo mejorá la claridad de la pregunta usando el contexto dado. Respondé únicamente con la pregunta refinada.",
          },
          {
            role: "user",
            content: `Requisito [${requirement.externalId}] ${requirement.name}: ${requirement.description}\nPregunta base: ${baseQuestion}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) return baseQuestion;

    const data = await res.json();
    const text: string | undefined = data?.choices?.[0]?.message?.content?.trim();
    return text || baseQuestion;
  } catch {
    return baseQuestion;
  }
}
