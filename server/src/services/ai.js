import { env } from '../config/env.js';

// Chat completion against NEAR AI Cloud (OpenAI-compatible endpoint).
export async function chat(messages, { maxTokens = env.ai.maxOutputTokens, responseFormat } = {}) {
  if (!env.ai.apiKey) throw new Error('AI_API_KEY is not set');
  const res = await fetch(`${env.ai.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.ai.apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: env.ai.model,
      messages,
      max_tokens: maxTokens,
      ...(responseFormat ? { response_format: responseFormat } : {}),
    }),
  });
  if (!res.ok) throw new Error(`AI request failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}
