export type AIMessage = { role: 'system' | 'user' | 'assistant'; content: string };
export type AIResult = { text: string; inputTokens: number | null; outputTokens: number | null };
export interface AIProvider {
 readonly providerName: string;
 readonly modelName: string;
 generate(messages: AIMessage[]): Promise<AIResult>;
 health(): Promise<{ available: boolean; reason: string | null }>;
}

/** Apply to every outbound message, including conversation history. */
export function minimizeQuestion(value: string) {
 return value.replace(/[\w.+-]+@[\w.-]+\.[A-Za-zА-Яа-я]{2,}/g, '[email удалён]')
  .replace(/\b\d{20}\b/g, '[счёт удалён]')
  .replace(/\b\d{10,12}\b/g, '[идентификатор удалён]')
  .replace(/(?:\+7|8)[\s()-]*\d(?:[\s()-]*\d){9}/g, '[телефон удалён]');
}

export class DeepSeekProvider implements AIProvider {
 readonly providerName = 'deepseek';
 readonly modelName: string;
 private readonly endpoint: string;
 private readonly config: {apiKey: string; model: string; baseUrl: string; timeoutMs?: number};
 private readonly request: typeof fetch;
 constructor(config: { apiKey: string; model: string; baseUrl: string; timeoutMs?: number }, request: typeof fetch = fetch) {
  this.config = config; this.request = request;
  const url = new URL(config.baseUrl);
  if (url.protocol !== 'https:' || url.hostname !== 'api.deepseek.com' || url.username || url.password || url.search || url.hash || !['', '/', '/v1', '/v1/'].includes(url.pathname)) throw Error('AI_ENDPOINT_INVALID');
  if (!config.apiKey || !config.model) throw Error('AI_CONFIGURATION_MISSING');
  this.modelName = config.model;
  this.endpoint = config.baseUrl.replace(/\/$/, '') + '/chat/completions';
 }
 async generate(messages: AIMessage[]): Promise<AIResult> {
  let response: Response;
  try {
   response = await this.request(this.endpoint, {
    method: 'POST', redirect: 'error',
    headers: {'Content-Type': 'application/json', Authorization: `Bearer ${this.config.apiKey}`},
    body: JSON.stringify({model: this.modelName, temperature: 0.2, max_tokens: 900, messages: messages.map(m => ({role: m.role, content: minimizeQuestion(m.content)}))}),
    signal: AbortSignal.timeout(this.config.timeoutMs ?? 25_000),
   });
  } catch { throw Error('AI_CONNECTION_UNAVAILABLE'); }
  if (!response.ok) throw Error(response.status === 429 ? 'AI_RATE_LIMITED' : 'AI_PROVIDER_UNAVAILABLE');
  let payload: {choices?: {message?: {content?: unknown}}[]; usage?: {prompt_tokens?: number; completion_tokens?: number}};
  try { payload = await response.json(); } catch { throw Error('AI_RESPONSE_INVALID'); }
  const text = payload?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim() || text.length > 24_000) throw Error('AI_RESPONSE_INVALID');
  // Guard explicit prohibited promises; structured grounding belongs to Block 19.
  if (/вероятность одобрения\s*[:—-]?\s*\d|гарантированн\w* (?:лимит|одобрение)|банк (?:точно )?одобрит|кредит точно получите/i.test(text)) throw Error('AI_RESPONSE_UNSUPPORTED_CLAIM');
  const tokens = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 ? n : null;
  return {text: text.trim(), inputTokens: tokens(payload.usage?.prompt_tokens), outputTokens: tokens(payload.usage?.completion_tokens)};
 }
 async health() {
  try {
   const result = await this.generate([{role: 'user', content: 'Return only JSON: {"ok":true}. This is a synthetic connectivity test.'}]);
   if (JSON.parse(result.text).ok !== true) throw Error('AI_RESPONSE_INVALID');
   return {available: true, reason: null};
  } catch { return {available: false, reason: 'AI_SMOKE_UNAVAILABLE'}; }
 }
}

export function configuredProvider(env: Record<string, string | undefined> = process.env): AIProvider | null {
 if (env.AI_PROVIDER && env.AI_PROVIDER !== 'deepseek') throw Error('AI_PROVIDER_UNSUPPORTED');
 if (!env.DEEPSEEK_API_KEY || !env.DEEPSEEK_MODEL) return null;
 return new DeepSeekProvider({apiKey: env.DEEPSEEK_API_KEY, model: env.DEEPSEEK_MODEL, baseUrl: env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'});
}

export async function generateWithFallback(provider: AIProvider | null, messages: AIMessage[], fallback: () => string) {
 if (provider) try { return {...await provider.generate(messages), mode: 'provider' as const, failure: null}; }
 catch { return {text: fallback(), inputTokens: null, outputTokens: null, mode: 'rules' as const, failure: 'AI_PROVIDER_UNAVAILABLE'}; }
 return {text: fallback(), inputTokens: null, outputTokens: null, mode: 'rules' as const, failure: null};
}
