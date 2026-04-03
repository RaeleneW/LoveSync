// services/llm.ts
import AsyncStorage from '@react-native-async-storage/async-storage'

export type ModelProvider = 'openai' | 'claude' | 'deepseek' | 'gemini' | 'qwen' | 'custom'

export interface LLMConfig {
  provider: ModelProvider
  apiKey: string
  model: string
  baseURL?: string
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMResponse {
  content: string
  usage?: { promptTokens: number; completionTokens: number }
}

export const PRESET_MODELS = [
  {
    provider: 'openai' as ModelProvider,
    label: 'OpenAI',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
    baseURL: 'https://api.openai.com/v1',
    placeholder: 'sk-...',
  },
  {
    provider: 'claude' as ModelProvider,
    label: 'Anthropic Claude',
    models: ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-4-5'],
    baseURL: 'https://api.anthropic.com',
    placeholder: 'sk-ant-...',
  },
  {
    provider: 'deepseek' as ModelProvider,
    label: 'DeepSeek',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    baseURL: 'https://api.deepseek.com/v1',
    placeholder: 'sk-...',
  },
  {
    provider: 'gemini' as ModelProvider,
    label: 'Google Gemini',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro'],
    baseURL: 'https://generativelanguage.googleapis.com/v1beta',
    placeholder: 'AIza...',
  },
  {
    provider: 'qwen' as ModelProvider,
    label: '通义千问',
    models: ['qwen-turbo', 'qwen-plus', 'qwen-max'],
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    placeholder: 'sk-...',
  },
  {
    provider: 'custom' as ModelProvider,
    label: '自定义接口',
    models: [],
    baseURL: '',
    placeholder: 'your-api-key',
  },
]

const STORAGE_KEY = 'lovesync:llm_config'

export async function saveLLMConfig(config: LLMConfig): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

export async function loadLLMConfig(): Promise<LLMConfig | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

export async function chatCompletion(
  messages: LLMMessage[],
  config?: LLMConfig | null,
  options?: { maxTokens?: number; temperature?: number }
): Promise<LLMResponse> {
  const cfg = config ?? (await loadLLMConfig())
  if (!cfg?.apiKey) throw new Error('未配置 API Key，请前往"我的"页面设置')

  const { maxTokens = 2000, temperature = 0.7 } = options ?? {}

  if (cfg.provider === 'claude') return _callClaude(messages, cfg, maxTokens, temperature)
  if (cfg.provider === 'gemini') return _callGemini(messages, cfg, maxTokens, temperature)
  return _callOpenAICompat(messages, cfg, maxTokens, temperature)
}

async function _callOpenAICompat(
  messages: LLMMessage[], cfg: LLMConfig, maxTokens: number, temperature: number
): Promise<LLMResponse> {
  const preset = PRESET_MODELS.find(p => p.provider === cfg.provider)
  const baseURL = cfg.baseURL || preset?.baseURL || 'https://api.openai.com/v1'
  const res = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({ model: cfg.model, messages, max_tokens: maxTokens, temperature }),
  })
  if (!res.ok) throw new Error(`API 错误 (${res.status}): ${await res.text()}`)
  const data = await res.json()
  return {
    content: data.choices?.[0]?.message?.content ?? '',
    usage: { promptTokens: data.usage?.prompt_tokens ?? 0, completionTokens: data.usage?.completion_tokens ?? 0 },
  }
}

async function _callClaude(
  messages: LLMMessage[], cfg: LLMConfig, maxTokens: number, temperature: number
): Promise<LLMResponse> {
  const systemMsg = messages.find(m => m.role === 'system')?.content ?? ''
  const userMsgs = messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content }))
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: cfg.model, max_tokens: maxTokens, temperature, system: systemMsg, messages: userMsgs }),
  })
  if (!res.ok) throw new Error(`Claude 错误 (${res.status}): ${await res.text()}`)
  const data = await res.json()
  return { content: data.content?.[0]?.text ?? '', usage: { promptTokens: data.usage?.input_tokens ?? 0, completionTokens: data.usage?.output_tokens ?? 0 } }
}

async function _callGemini(
  messages: LLMMessage[], cfg: LLMConfig, maxTokens: number, temperature: number
): Promise<LLMResponse> {
  const systemMsg = messages.find(m => m.role === 'system')?.content ?? ''
  const contents = messages.filter(m => m.role !== 'system').map((m, i) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: i === 0 && systemMsg ? `${systemMsg}\n\n${m.content}` : m.content }],
  }))
  const model = cfg.model || 'gemini-2.0-flash'
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cfg.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents, generationConfig: { maxOutputTokens: maxTokens, temperature } }),
  })
  if (!res.ok) throw new Error(`Gemini 错误 (${res.status}): ${await res.text()}`)
  const data = await res.json()
  return { content: data.candidates?.[0]?.content?.parts?.[0]?.text ?? '', usage: { promptTokens: data.usageMetadata?.promptTokenCount ?? 0, completionTokens: data.usageMetadata?.candidatesTokenCount ?? 0 } }
}

export async function testAPIKey(config: LLMConfig): Promise<{ ok: boolean; error?: string }> {
  try {
    await chatCompletion([{ role: 'user', content: '回复ok' }], config, { maxTokens: 10, temperature: 0 })
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? '未知错误' }
  }
}
