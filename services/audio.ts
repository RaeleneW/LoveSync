// services/audio.ts
import { Audio } from 'expo-av'
import * as FileSystem from 'expo-file-system/legacy'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { TranscriptLine } from './analyzer'

let _recording: Audio.Recording | null = null
let _startTime = 0

// ── STT 配置 ──────────────────────────────────────────────────
export interface STTConfig {
  provider: 'siliconflow' | 'groq' | 'openai' | 'custom'
  apiKey: string
  model: string    // 用户可自定义，有默认值
  baseURL?: string // custom 时必填
}

const STT_STORAGE_KEY = 'ls:stt_config'

export async function saveSTTConfig(cfg: STTConfig) {
  await AsyncStorage.setItem(STT_STORAGE_KEY, JSON.stringify(cfg))
}
export async function loadSTTConfig(): Promise<STTConfig | null> {
  const raw = await AsyncStorage.getItem(STT_STORAGE_KEY)
  return raw ? JSON.parse(raw) : null
}

export const STT_PRESETS = [
  {
    provider: 'siliconflow' as const,
    label: 'SiliconFlow（推荐·免费）',
    desc: '国内服务器 · 免费 · 中文识别准确',
    baseURL: 'https://api.siliconflow.cn/v1',
    defaultModel: 'FunAudioLLM/SenseVoiceSmall',
    placeholder: 'sk-...',
  },
  {
    provider: 'groq' as const,
    label: 'Groq（免费·快）',
    desc: '完全免费 · 速度极快',
    baseURL: 'https://api.groq.com/openai/v1',
    defaultModel: 'whisper-large-v3-turbo',
    placeholder: 'gsk_...',
  },
  {
    provider: 'openai' as const,
    label: 'OpenAI Whisper',
    desc: '官方 · 按分钟计费',
    baseURL: 'https://api.openai.com/v1',
    defaultModel: 'whisper-1',
    placeholder: 'sk-...',
  },
  {
    provider: 'custom' as const,
    label: '自定义',
    desc: '兼容 OpenAI 格式的 STT',
    baseURL: '',
    defaultModel: 'whisper-1',
    placeholder: 'your-api-key',
  },
]

// ── 验证 STT Key ───────────────────────────────────────────────
export async function testSTTKey(cfg: STTConfig): Promise<{ ok: boolean; error?: string }> {
  try {
    const preset = STT_PRESETS.find(p => p.provider === cfg.provider)
    const baseURL = cfg.provider === 'custom' ? (cfg.baseURL ?? '') : (preset?.baseURL ?? '')
    const url = `${baseURL.replace(/\/$/, '')}/audio/transcriptions`

    // 最小 WAV（44字节头+空数据），Key 错返回 401，Key 对返回 200/400
    const minWav = 'UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='
    const tempUri = FileSystem.cacheDirectory + 'stt_test.wav'
    await FileSystem.writeAsStringAsync(tempUri, minWav, {
      encoding: 'base64',
    })

    const result = await FileSystem.uploadAsync(url, tempUri, {
      httpMethod: 'POST',
      uploadType: 1,
      fieldName: 'file',
      mimeType: 'audio/wav',
      parameters: { model: cfg.model || preset?.defaultModel || 'whisper-1', response_format: 'text' },
      headers: { Authorization: `Bearer ${cfg.apiKey}` },
      sessionType: 1,
    })

    await FileSystem.deleteAsync(tempUri, { idempotent: true })

    if (result.status === 401) return { ok: false, error: 'API Key 无效' }
    if (result.status === 403) return { ok: false, error: '无访问权限' }
    if (result.status === 404) return { ok: false, error: '接口地址不存在，请检查 Base URL' }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? '网络连接失败' }
  }
}

// ── 录音 ──────────────────────────────────────────────────────
export async function requestMicPermission(): Promise<boolean> {
  const { status } = await Audio.requestPermissionsAsync()
  return status === 'granted'
}

export async function startRecording(): Promise<void> {
  if (_recording) {
    try { await _recording.stopAndUnloadAsync() } catch {}
    _recording = null
  }
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  })
  const { recording } = await Audio.Recording.createAsync(
    Audio.RecordingOptionsPresets.HIGH_QUALITY
  )
  _recording = recording
  _startTime = Date.now()
}

export async function stopRecording(): Promise<{ uri: string; duration: number } | null> {
  if (!_recording) return null
  const duration = Math.round((Date.now() - _startTime) / 1000)
  const uri = _recording.getURI() ?? ''
  try { await _recording.stopAndUnloadAsync() } catch {}
  _recording = null
  try { await Audio.setAudioModeAsync({ allowsRecordingIOS: false }) } catch {}
  if (!uri) return null
  return { uri, duration }
}

// ── 语音转文字 ────────────────────────────────────────────────
export async function transcribeAudio(
  audioUri: string,
  _nameA: string,
  _nameB: string,
): Promise<TranscriptLine[]> {
  const sttCfg = await loadSTTConfig()
  if (!sttCfg?.apiKey) {
    throw new Error('未配置语音转文字 Key\n请在"我的"页面 → 语音转文字 中配置')
  }

  const preset = STT_PRESETS.find(p => p.provider === sttCfg.provider)
  const baseURL = sttCfg.provider === 'custom'
    ? (sttCfg.baseURL ?? '')
    : (preset?.baseURL ?? '')
  const model = sttCfg.model || preset?.defaultModel || 'whisper-1'
  const url = `${baseURL.replace(/\/$/, '')}/audio/transcriptions`

  const uploadResult = await FileSystem.uploadAsync(url, audioUri, {
    httpMethod: 'POST',
    uploadType: 1,
    fieldName: 'file',
    mimeType: 'audio/m4a',
    parameters: {
      model,
      language: 'zh',
      response_format: 'verbose_json',
      'timestamp_granularities[]': 'segment',
    },
    headers: { Authorization: `Bearer ${sttCfg.apiKey}` },
    sessionType: 1,
  })

  if (uploadResult.status === 401) throw new Error('STT Key 无效，请在"我的"页面重新配置')
  if (uploadResult.status !== 200) throw new Error(`STT 失败 (${uploadResult.status}): ${uploadResult.body}`)

  let data: any
  try { data = JSON.parse(uploadResult.body) } catch { throw new Error('STT 返回格式异常') }

  const segments: any[] = data.segments ?? []
  if (segments.length === 0) {
    const fullText = (data.text ?? '').trim()
    if (!fullText) throw new Error('未识别到语音，请靠近手机说话后重试')
    return [{ speaker: 'A', timestamp: 0, text: fullText }]
  }

  return segments
    .map((seg: any, i: number): TranscriptLine => ({
      speaker: i % 2 === 0 ? 'A' : 'B',
      timestamp: Math.round(seg.start ?? 0),
      text: (seg.text ?? '').trim(),
    }))
    .filter(l => l.text.length > 0)
}

export function getMockTranscript(nameA: string, nameB: string): TranscriptLine[] {
  return [
    { speaker: 'A', timestamp: 9,   text: `你为什么看到东西都不主动拿一下？` },
    { speaker: 'B', timestamp: 17,  text: `那个不重啊，而且你不是喜欢自己拿嘛。` },
    { speaker: 'A', timestamp: 28,  text: `什么叫我喜欢自己拿，你就是懒！` },
    { speaker: 'B', timestamp: 36,  text: `我没有懒，我是有原则的，重的我都会帮你拿。` },
    { speaker: 'A', timestamp: 46,  text: `我不信，你之前那次行李你也没拿。` },
    { speaker: 'B', timestamp: 58,  text: `那次是因为...算了，那个变成水了很恶心。` },
    { speaker: 'A', timestamp: 68,  text: `什么变成水，根本没有这回事！` },
    { speaker: 'B', timestamp: 78,  text: `真的有！里面的东西坏掉了。` },
    { speaker: 'A', timestamp: 86,  text: `你在找借口，就是不想帮忙。` },
    { speaker: 'B', timestamp: 96,  text: `我真的是……好吧，算我没说。` },
    { speaker: 'A', timestamp: 110, text: `你看，承认了吧。` },
  ]
}
