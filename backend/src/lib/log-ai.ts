import type { FastifyBaseLogger } from "fastify";
import { env } from "../env";

type LogFragment = {
  ts: number;
  level: string;
  message: string;
  context?: Record<string, unknown>;
};

export async function summarizeLogsWithAi(
  logger: FastifyBaseLogger,
  fragments: LogFragment[],
  serviceName: string
): Promise<string | null> {
  if (!env.AI_LOG_SUMMARY_ENABLED || !env.DEEPSEEK_API_KEY) {
    return null;
  }
  if (!fragments.length) return null;

  // Prepare prompt with a hard cap
  const sorted = fragments.slice(-200);
  const lines = sorted
    .map((f) => {
      const ts = new Date(f.ts).toISOString();
      const ctx = f.context ? ` ctx=${JSON.stringify(f.context).slice(0, 200)}` : "";
      return `[${ts}] [${f.level}] ${f.message}${ctx}`;
    })
    .join("\n")
    .slice(0, 8000); // keep prompt small

  const prompt = `You are assisting with incident triage for service "${serviceName}".
Given the recent log lines below, produce a concise summary with:
- What changed / main symptoms
- Likely causes or components to inspect
- 3–5 suggested next steps for engineers

Keep it under 120 words. Use bullet points for suggested steps.

Logs:
${lines}`;

  try {
    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "You are a concise SRE assistant." },
          { role: "user", content: prompt }
        ],
        max_tokens: 256,
        temperature: 0.2
      })
    });

    if (!response.ok) {
      const text = await response.text();
      logger.warn({ status: response.status, text }, "AI summary request failed");
      return null;
    }
    const json = (await response.json()) as any;
    const content = json?.choices?.[0]?.message?.content;
    return typeof content === "string" ? content.trim() : null;
  } catch (err) {
    logger.warn({ err }, "AI summary request error");
    return null;
  }
}
