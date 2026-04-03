// services/storage.ts
import AsyncStorage from '@react-native-async-storage/async-storage'

export interface UserProfile {
  nameA: string
  nameB: string
  avatarA?: string   // emoji 或本地图片 URI
  avatarB?: string
  createdAt: number
}

export interface EmotionPoint {
  timestamp: number
  speakerA: number
  speakerB: number
  isFlashpoint: boolean
  highlight?: string
}

export interface ConflictPoint {
  timestamp: number
  text: string
  speaker: 'A' | 'B'
}

export interface RadarData {
  empathy: number
  logic: number
  aggression: number
  defensiveness: number
  listeningDesire: number
}

export interface AnalysisReport {
  harmonyScore: number
  resonanceScore: number
  aiSummary: string
  emotionTimeline: EmotionPoint[]
  conflictPoints: ConflictPoint[]
  radar: RadarData
  radarB: RadarData
  radarInsight: string
  trend: {
    emotionalStability: 'up' | 'down' | 'stable'
    conflictFrequency: 'up' | 'down' | 'stable'
    harmony: 'up' | 'down' | 'stable'
  }
  rootCause: string
  triggerTopic: string
  advice: string
  mediationSuggestion: string
  mainIssueOwner: 'A' | 'B' | 'both' | 'none'
  mainIssueReason: string
  category: 'sweet' | 'conflict' | 'neutral'
  categoryLabel: string
}

export interface ConversationRecord {
  id: string
  createdAt: number
  duration: number
  report: AnalysisReport
}

export interface CheckinRecord {
  id: string
  date: string        // YYYY-MM-DD
  type: 'meal' | 'date' | 'home' | 'other'
  label: string
  note?: string
  createdAt: number
}

export interface GamesState {
  totalXP: number
  level: number
  unlockedGames: string[]
}

const K = {
  CHECKIN: 'ls:checkins',
  PROFILE: 'ls:profile',
  RECORDS: 'ls:records',
  REC:     'ls:rec:',
  GAMES:   'ls:games',
} as const

// ── Profile ──────────────────────────────────────────────────
export async function saveProfile(p: UserProfile) {
  await AsyncStorage.setItem(K.PROFILE, JSON.stringify(p))
}
export async function loadProfile(): Promise<UserProfile | null> {
  const raw = await AsyncStorage.getItem(K.PROFILE)
  return raw ? JSON.parse(raw) : null
}

// ── Records ───────────────────────────────────────────────────
export async function saveRecord(rec: ConversationRecord) {
  await AsyncStorage.setItem(K.REC + rec.id, JSON.stringify(rec))
  const ids = await _loadIds()
  await AsyncStorage.setItem(K.RECORDS, JSON.stringify([rec.id, ...ids.filter(i => i !== rec.id)]))
}
export async function loadRecord(id: string): Promise<ConversationRecord | null> {
  const raw = await AsyncStorage.getItem(K.REC + id)
  return raw ? JSON.parse(raw) : null
}
export async function loadRecentRecords(limit = 30): Promise<ConversationRecord[]> {
  const ids = (await _loadIds()).slice(0, limit)
  const recs = await Promise.all(ids.map(loadRecord))
  return recs.filter(Boolean) as ConversationRecord[]
}
export async function deleteRecord(id: string) {
  await AsyncStorage.removeItem(K.REC + id)
  const ids = await _loadIds()
  await AsyncStorage.setItem(K.RECORDS, JSON.stringify(ids.filter(i => i !== id)))
}
async function _loadIds(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(K.RECORDS)
  return raw ? JSON.parse(raw) : []
}

// ── Weekly stats ──────────────────────────────────────────────
export async function computeWeeklyStats() {
  const recs = await loadRecentRecords(100)
  const cutoff = Date.now() - 7 * 86400_000
  const week = recs.filter(r => r.createdAt >= cutoff)
  const daily: Record<string, number[]> = {}
  let sweet = 0, conflict = 0
  for (const r of week) {
    const day = new Date(r.createdAt).toISOString().slice(0, 10)
    ;(daily[day] ??= []).push(r.report.harmonyScore)
    if (r.report.category === 'sweet') sweet++
    if (r.report.category === 'conflict') conflict++
  }
  const avg: Record<string, number> = {}
  for (const [d, scores] of Object.entries(daily))
    avg[d] = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
  return { daily: avg, sweetCount: sweet, conflictCount: conflict }
}

// ── Games ─────────────────────────────────────────────────────
export async function loadGamesState(): Promise<GamesState> {
  const raw = await AsyncStorage.getItem(K.GAMES)
  if (raw) return JSON.parse(raw)
  return { totalXP: 240, level: 12, unlockedGames: ['know_me', 'compliment'] }
}
export async function addXP(amount: number): Promise<GamesState> {
  const state = await loadGamesState()
  state.totalXP += amount
  state.level = _xpToLevel(state.totalXP)
  // 解锁逻辑：每5级一个
  const unlocks: Record<number, string> = {
    5:  'daily_task',
    10: 'role_swap',
    15: 'gratitude',
    20: 'creative_q',
    25: 'memory_q',
    30: 'wish_q',
  }
  for (const [lvl, game] of Object.entries(unlocks)) {
    if (state.level >= Number(lvl) && !state.unlockedGames.includes(game))
      state.unlockedGames.push(game)
  }
  await AsyncStorage.setItem(K.GAMES, JSON.stringify(state))
  return state
}
function _xpToLevel(xp: number): number {
  let l = 1
  while (l * l * 100 <= xp) l++
  return Math.max(1, l - 1)
}
export function levelProgress(state: GamesState) {
  const cur = state.level * state.level * 100
  const next = (state.level + 1) * (state.level + 1) * 100
  const prev = Math.max(0, (state.level - 1) * (state.level - 1) * 100)
  const earned = state.totalXP - prev
  const needed = next - prev
  return { current: earned, required: needed, pct: Math.round((earned / needed) * 100) }
}

// ── ID helper ─────────────────────────────────────────────────
export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

// ── 打卡记录 ──────────────────────────────────────────────────
export async function saveCheckin(rec: CheckinRecord): Promise<void> {
  const raw = await AsyncStorage.getItem(K.CHECKIN)
  const list: CheckinRecord[] = raw ? JSON.parse(raw) : []
  list.unshift(rec)
  await AsyncStorage.setItem(K.CHECKIN, JSON.stringify(list))
}

export async function loadCheckins(): Promise<CheckinRecord[]> {
  const raw = await AsyncStorage.getItem(K.CHECKIN)
  return raw ? JSON.parse(raw) : []
}

export async function deleteCheckin(id: string): Promise<void> {
  const raw = await AsyncStorage.getItem(K.CHECKIN)
  const list: CheckinRecord[] = raw ? JSON.parse(raw) : []
  await AsyncStorage.setItem(K.CHECKIN, JSON.stringify(list.filter(r => r.id !== id)))
}

// ── Clear all (except LLM config) ────────────────────────────
export async function clearAllData() {
  const ids = await _loadIds()
  await AsyncStorage.multiRemove([K.PROFILE, K.RECORDS, K.GAMES, ...ids.map(i => K.REC + i)])
}
