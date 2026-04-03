// services/analyzer.ts
import { chatCompletion } from './llm'
import type { AnalysisReport } from './storage'

export interface TranscriptLine {
  speaker: 'A' | 'B'
  timestamp: number
  text: string
}

const SYSTEM = `你是"LoveSync AI判官"，专门分析情侣对话的情感动态。
风格：犀利但温柔，像懂心理学的闺蜜，偶尔幽默吐槽但不刻薄。
任务：分析对话文字稿，返回严格JSON，不要任何markdown包裹或额外文字。

评分维度：
- harmonyScore 默契度：理解对方意图、顺畅沟通的程度
- resonanceScore 情感共鸣：情绪是否同频
- radar 五维（A方）：empathy共情力 logic逻辑性 aggression攻击性 defensiveness防御性 listeningDesire倾听欲
- radarB 五维（B方）：同上
爆发点：明显指责/情绪激化/双方拉锯时 isFlashpoint=true`

function buildPrompt(lines: TranscriptLine[], nameA: string, nameB: string): string {
  const transcript = lines
    .map(l => `[${_fmt(l.timestamp)}] ${l.speaker === 'A' ? nameA : nameB}：${l.text}`)
    .join('\n')

  return `以下是${nameA}（A）和${nameB}（B）的对话：

${transcript}

请返回如下JSON（所有分数0-100整数）：
{
  "harmonyScore": <整数>,
  "resonanceScore": <整数>,
  "aiSummary": "<200字内幽默总结，第三人称>",
  "emotionTimeline": [
    {"timestamp":0, "speakerA":30, "speakerB":35, "isFlashpoint":false, "highlight":""},
    ...至少8个点，timestamp均匀覆盖对话全程...
  ],
  // emotionTimeline 规则（必须严格遵守）：
  // 1. 必须返回至少8个时间点，从0均匀分布到对话结束
  // 2. speakerA 和 speakerB 的值必须独立变化，不能同步
  // 3. 整个时间线中，每人的情绪值最高点和最低点差值必须大于40
  // 4. 冲突时情绪值应达到70-95，平静时应低至15-40
  // 5. isFlashpoint=true 时该点情绪值至少一方要超过75
  "conflictPoints": [{"timestamp":<秒>,"text":"<原文摘录>","speaker":"<A或B>"}],
  "radar": {"empathy":<>,"logic":<>,"aggression":<>,"defensiveness":<>,"listeningDesire":<>},
  "radarB": {"empathy":<>,"logic":<>,"aggression":<>,"defensiveness":<>,"listeningDesire":<>},
  "radarInsight": "<一句话指出两人最显著差异>",
  "trend": {"emotionalStability":"<up/down/stable>","conflictFrequency":"<up/down/stable>","harmony":"<up/down/stable>"},
  "rootCause": "<冲突深层心理原因1-2句>",
  "triggerTopic": "<直接触发话题>",
  "advice": "<给双方的改善建议各1句>",
  "mediationSuggestion": "<2-3句可操作的和解步骤>",
  "mainIssueOwner": "<A或B或both或none，sweet时填none>",
  "mainIssueReason": "<一句话说明原因，none时留空>",
  "category": "<sweet/conflict/neutral>",
  "categoryLabel": "<话题标签如：帮助与付出>"
}`
}

function _clamp(v: number) { return Math.max(0, Math.min(100, Math.round(v || 0))) }
function _fmt(s: number) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60)
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
}

function parseResponse(raw: string): AnalysisReport {
  const clean = raw.replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/```\s*$/i,'').trim()
  const p = JSON.parse(clean)
  const radarDefaults = { empathy:50, logic:50, aggression:30, defensiveness:30, listeningDesire:50 }
  return {
    harmonyScore:   _clamp(p.harmonyScore ?? 50),
    resonanceScore: _clamp(p.resonanceScore ?? 50),
    aiSummary:      p.aiSummary ?? '分析完成。',
    emotionTimeline: (() => {
      const raw = (p.emotionTimeline ?? []).map((x: any) => ({
        timestamp:    x.timestamp ?? 0,
        speakerA:     _clamp(x.speakerA ?? 50),
        speakerB:     _clamp(x.speakerB ?? 50),
        isFlashpoint: x.isFlashpoint === true,
        highlight:    x.highlight,
      }))
      // 文字模式下时间戳都很小，均匀分布到 0-180 秒
      const maxTs = Math.max(...raw.map(r => r.timestamp), 0)
      let result = raw
      if (maxTs < 30 && raw.length > 1) {
        result = raw.map((r, i) => ({ ...r, timestamp: Math.round(i * 180 / (raw.length - 1)) }))
      }
      // 强制拉伸：把情绪值映射到更大的显示范围，让波形更夸张
      if (result.length > 1) {
        const aVals = result.map(r => r.speakerA)
        const bVals = result.map(r => r.speakerB)
        const aMin = Math.min(...aVals), aMax = Math.max(...aVals)
        const bMin = Math.min(...bVals), bMax = Math.max(...bVals)
        const aSpread = aMax - aMin
        const bSpread = bMax - bMin

        // 如果波动不够大（< 35），强制拉伸到 15-90 的范围
        if (aSpread < 35 || bSpread < 35) {
          result = result.map(r => {
            const newA = aSpread < 5
              ? r.speakerA  // 真的平坦，后面用正弦处理
              : Math.round(15 + ((r.speakerA - aMin) / aSpread) * 75)
            const newB = bSpread < 5
              ? r.speakerB
              : Math.round(10 + ((r.speakerB - bMin) / bSpread) * 70)
            return { ...r, speakerA: newA, speakerB: newB }
          })
        }

        // 如果拉伸后还是平坦（原始数据方差为0），用正弦波兜底
        const aVals2 = result.map(r => r.speakerA)
        if (Math.max(...aVals2) - Math.min(...aVals2) < 5) {
          const mean = aVals2.reduce((s, v) => s + v, 0) / aVals2.length
          result = result.map((r, i) => {
            const t = i / Math.max(result.length - 1, 1)
            return {
              ...r,
              speakerA: Math.round(Math.max(10, Math.min(90, mean + Math.sin(t * Math.PI * 2) * 30))),
              speakerB: Math.round(Math.max(10, Math.min(90, (r.speakerB || 45) + Math.cos(t * Math.PI * 2) * 25))),
            }
          })
        }
      }
      return result
    })(),
    conflictPoints: (p.conflictPoints ?? []).map((x: any) => ({
      timestamp: x.timestamp ?? 0,
      text:      x.text ?? '',
      speaker:   x.speaker ?? 'A',
    })),
    radar:  { ...radarDefaults, ...Object.fromEntries(Object.entries(p.radar ?? {}).map(([k,v]) => [k, _clamp(v as number)])) } as any,
    radarB: { ...radarDefaults, ...Object.fromEntries(Object.entries(p.radarB ?? {}).map(([k,v]) => [k, _clamp(v as number)])) } as any,
    radarInsight: p.radarInsight ?? '',
    trend: {
      emotionalStability: p.trend?.emotionalStability ?? 'stable',
      conflictFrequency:  p.trend?.conflictFrequency ?? 'stable',
      harmony:            p.trend?.harmony ?? 'stable',
    },
    rootCause:           p.rootCause ?? '',
    triggerTopic:        p.triggerTopic ?? '',
    advice:              p.advice ?? '',
    mediationSuggestion: p.mediationSuggestion ?? '',
    mainIssueOwner:      (['A','B','both','none'].includes(p.mainIssueOwner) ? p.mainIssueOwner : 'none') as 'A'|'B'|'both'|'none',
    mainIssueReason:     p.mainIssueReason ?? '',
    category:            p.category ?? 'neutral',
    categoryLabel:       p.categoryLabel ?? '日常对话',
  }
}

export async function analyzeConversation(
  transcript: TranscriptLine[],
  nameA: string,
  nameB: string,
): Promise<AnalysisReport> {
  if (!transcript.length) throw new Error('对话内容为空')
  const res = await chatCompletion(
    [{ role: 'system', content: SYSTEM }, { role: 'user', content: buildPrompt(transcript, nameA, nameB) }],
    null,
    { maxTokens: 2500, temperature: 0.65 }
  )
  return parseResponse(res.content)
}
