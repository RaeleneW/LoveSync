// services/inspiration.ts
// 每次启动 App 调用 AI 生成今日爱情灵感，结果缓存当天
import AsyncStorage from '@react-native-async-storage/async-storage'
import { chatCompletion } from './llm'
import { getDailyInspiration } from '../constants/inspirations'

const KEY = 'ls:daily_inspiration'

interface CachedInspiration {
  date: string   // YYYY-MM-DD
  text: string
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export async function getDailyInspirationAI(): Promise<string> {
  const today = todayStr()

  // 先查缓存
  try {
    const raw = await AsyncStorage.getItem(KEY)
    if (raw) {
      const cached: CachedInspiration = JSON.parse(raw)
      if (cached.date === today) return cached.text
    }
  } catch {}

  // 调用 AI 生成
  try {
    const res = await chatCompletion(
      [{
        role: 'user',
        content: '请生成一句关于情侣感情的温柔励志短句，要求：\n1. 20字以内\n2. 温柔有诗意，不俗气\n3. 适合作为今日提醒\n4. 只输出这一句话，不要引号、序号或任何其他内容',
      }],
      null,
      { maxTokens: 60, temperature: 0.9 }
    )
    const text = res.content.trim().replace(/^["'"']|["'"']$/g, '')
    if (text.length > 0 && text.length <= 50) {
      await AsyncStorage.setItem(KEY, JSON.stringify({ date: today, text }))
      return text
    }
  } catch {}

  // 降级：用本地库
  return getDailyInspiration()
}
