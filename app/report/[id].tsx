// app/report/[id].tsx
import React, { useEffect, useState, useRef } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput, KeyboardAvoidingView,
  Platform, FlatList, Modal, Animated, Alert,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { spacing, radius } from '../../constants/theme'
import { useTheme } from '../../contexts/ThemeContext'
import { loadRecord, loadProfile, type ConversationRecord } from '../../services/storage'
import { chatCompletion } from '../../services/llm'
import { AvatarPair, Card, SectionTitle, TrendRow, Divider, CategoryBadge, Legend } from '../../components/UI'
import RadarChart from '../../components/RadarChart'
import EmotionChart from '../../components/EmotionChart'
import Svg, { Path, Line as SvgLine } from 'react-native-svg'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'

type Tab = 'overview' | 'insight' | 'coach'

// AI 教练对话消息
interface Message {
  role: 'user' | 'ai'
  text: string
}

export default function ReportScreen() {
  const { theme } = useTheme()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [rec, setRec]           = useState<ConversationRecord | null>(null)
  const [profile, setProfile]   = useState<{ nameA: string; nameB: string; avatarA?: string; avatarB?: string } | null>(null)
  const [tab, setTab]           = useState<Tab>('overview')
  const [loading, setLoading]   = useState(true)
  // AI 教练
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput]       = useState('')
  const [aiTyping, setAiTyping] = useState(false)
  const [phrases, setPhrases]     = useState<string[]>([])
  const [loadingPhrases, setLoadingPhrases] = useState(false)
  const [tasks, setTasks]         = useState<string[]>([])
  const [loadingTasks, setLoadingTasks]     = useState(false)
  const [tasksDone, setTasksDone] = useState<boolean[]>([])
  const [showTaskModal, setShowTaskModal]   = useState(false)
  const flatRef = useRef<FlatList>(null)

  useEffect(() => {
    ;(async () => {
      const [r, p] = await Promise.all([loadRecord(id), loadProfile()])
      setRec(r); setProfile(p); setLoading(false)
    })()
  }, [id])

  // 进入教练页时生成话术
  useEffect(() => {
    if (tab === 'coach' && rec && phrases.length === 0) {
      generatePhrases()
      generateTasks()
      // 初始化欢迎消息
      if (messages.length === 0) {
        const nameA = profile?.nameA ?? '你'
        const nameB = profile?.nameB ?? 'TA'
        setMessages([{
          role: 'ai',
          text: `我已经了解了你们这次的情况。\n\n可以问我任何问题，比如：\n• "我现在怎么跟${nameB}开口？"\n• "${nameA}应该怎么道歉？"\n• "我们该怎么避免下次再吵？"`,
        }])
      }
    }
  }, [tab, rec])

  async function generatePhrases() {
    if (!rec || loadingPhrases) return
    setLoadingPhrases(true)
    const nameA = profile?.nameA ?? '你'
    const nameB = profile?.nameB ?? 'TA'
    try {
      const res = await chatCompletion([{
        role: 'user',
        content: `以下是一对情侣的对话分析结果：
冲突根源：${rec.report.rootCause}
调解建议：${rec.report.mediationSuggestion}
AI总结：${rec.report.aiSummary}

请生成4句具体的"破冰话术"，帮助${nameA}主动开口和解。要求：
1. 口语化，像真实人说话
2. 不卑不亢，不是道歉也不是质问
3. 每句话控制在30字以内
4. 直接输出4句话，每句一行，不要编号和解释`
      }], null, { maxTokens: 300, temperature: 0.8 })

      const lines = res.content.split('\n').map(l => l.trim()).filter(l => l.length > 4 && l.length < 60)
      setPhrases(lines.slice(0, 4))
    } catch {}
    setLoadingPhrases(false)
  }

  async function generateTasks() {
    if (!rec || loadingTasks || tasks.length > 0) return
    setLoadingTasks(true)
    const nameA = profile?.nameA ?? '你'
    const nameB = profile?.nameB ?? 'TA'
    try {
      const res = await chatCompletion([{
        role: 'user',
        content: `基于以下情侣对话分析，生成3个今日调解任务让双方共同执行：
冲突根源：${rec.report.rootCause}
主要问题：${rec.report.mainIssueReason}
调解建议：${rec.report.mediationSuggestion}

要求：
1. 每个任务都是今天可以完成的具体行动
2. 任务要双方共同参与，不能只针对一方
3. 用第二人称「你们」开头，口语化
4. 每个任务一行，不超过30字
5. 只输出3个任务，不要编号和解释`
      }], null, { maxTokens: 200, temperature: 0.7 })
      const lines = res.content.split('\n').map(l => l.trim()).filter(l => l.length > 5 && l.length < 60)
      const t = lines.slice(0, 3)
      setTasks(t)
      setTasksDone(new Array(t.length).fill(false))
    } catch {}
    setLoadingTasks(false)
  }

  async function sendMessage() {
    if (!input.trim() || aiTyping || !rec) return
    const userText = input.trim()
    setInput('')
    const newMessages: Message[] = [...messages, { role: 'user', text: userText }]
    setMessages(newMessages)
    setAiTyping(true)
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100)

    try {
      const nameA = profile?.nameA ?? '你'
      const nameB = profile?.nameB ?? 'TA'
      const context = `你是一位专业的情感调解顾问，温和而直接。你已经分析了${nameA}和${nameB}的对话：
- AI总结：${rec.report.aiSummary}
- 冲突根源：${rec.report.rootCause}
- 调解建议：${rec.report.mediationSuggestion}
- 默契度：${rec.report.harmonyScore}%

请根据这个背景回答用户的问题。回复要简洁实用，不超过150字，直接给出可操作的建议。`

      const history = newMessages.map(m => ({
        role: m.role === 'user' ? 'user' as const : 'assistant' as const,
        content: m.text,
      }))

      const res = await chatCompletion([
        { role: 'system', content: context },
        ...history,
      ], null, { maxTokens: 400, temperature: 0.7 })

      setMessages(prev => [...prev, { role: 'ai', text: res.content }])
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'ai', text: '抱歉，暂时无法回答，请稍后再试。' }])
    }
    setAiTyping(false)
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100)
  }

  if (loading) return <View style={[styles.loading, { backgroundColor: theme.bg }]}><ActivityIndicator color={theme.primary} size="large"/></View>
  if (!rec)    return <View style={[styles.loading, { backgroundColor: theme.bg }]}><Text style={{color:theme.text2}}>记录不存在</Text></View>

  const { report } = rec
  const nameA = profile?.nameA ?? '伴侣A'
  const nameB = profile?.nameB ?? '伴侣B'

  async function handleExport() {
    if (!rec) return
    const nameA = profile?.nameA ?? '伴侣A'
    const nameB = profile?.nameB ?? '伴侣B'
    const d = new Date(rec.createdAt)
    const dateStr = `${d.getMonth()+1}月${d.getDate()}日 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
    const r = report

    // 雷达数据
    const radarRows = [
      ['共情力',  r.radar.empathy,        r.radarB.empathy],
      ['逻辑性',  r.radar.logic,          r.radarB.logic],
      ['攻击性',  r.radar.aggression,     r.radarB.aggression],
      ['倾听欲',  r.radar.listeningDesire,r.radarB.listeningDesire],
      ['防御性',  r.radar.defensiveness,  r.radarB.defensiveness],
    ]

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:-apple-system,sans-serif;background:#0A0A0C;color:#E8E4F0;padding:32px 28px;}
.logo{text-align:center;font-size:26px;font-weight:700;color:#FF6B9D;letter-spacing:3px;margin-bottom:6px;}
.names{text-align:center;font-size:17px;color:#C4BEDD;margin-bottom:4px;}
.date{text-align:center;font-size:12px;color:rgba(255,255,255,0.3);margin-bottom:20px;}
.badge{display:inline-block;background:rgba(255,107,157,0.15);color:#FF6B9D;border-radius:20px;padding:5px 16px;font-size:13px;border:1px solid rgba(255,107,157,0.3);margin:0 auto 20px;display:block;width:fit-content;}
.scores{display:flex;gap:12px;margin-bottom:20px;}
.score-card{flex:1;background:rgba(255,107,157,0.08);border-radius:12px;padding:16px;text-align:center;border:1px solid rgba(255,107,157,0.2);}
.score-num{font-size:30px;font-weight:700;color:#FF6B9D;}
.score-lbl{font-size:11px;color:rgba(255,255,255,0.35);margin-top:4px;}
.section{margin-bottom:16px;}
.section-lbl{font-size:11px;color:rgba(255,255,255,0.35);letter-spacing:1px;margin-bottom:8px;}
.card{background:rgba(255,255,255,0.05);border-radius:12px;padding:14px;border:1px solid rgba(255,255,255,0.08);font-size:14px;color:#C4BEDD;line-height:1.8;}
.pink{color:#FF6B9D;}
.green{color:#4CAF7D;}
.issue-card{background:rgba(255,107,157,0.08);border-left:3px solid #FF6B9D;border-radius:0 10px 10px 0;padding:12px 14px;margin-bottom:16px;}
.med-card{background:rgba(76,175,125,0.08);border-left:3px solid #4CAF7D;border-radius:0 10px 10px 0;padding:12px 14px;margin-bottom:16px;}
.radar-table{width:100%;border-collapse:collapse;margin-top:8px;}
.radar-table td{padding:8px 4px;font-size:13px;color:#C4BEDD;border-bottom:1px solid rgba(255,255,255,0.05);}
.radar-bar-bg{background:rgba(255,255,255,0.08);border-radius:4px;height:6px;overflow:hidden;width:100px;display:inline-block;vertical-align:middle;}
.radar-bar-a{background:#FF6B9D;height:6px;border-radius:4px;}
.radar-bar-b{background:#9B7FE8;height:6px;border-radius:4px;}
.divider{height:1px;background:rgba(255,255,255,0.07);margin:20px 0;}
.footer{text-align:center;font-size:11px;color:rgba(255,255,255,0.2);margin-top:24px;}
</style></head><body>

<div class="logo">LoveSync</div>
<div class="names">${nameA} & ${nameB}</div>
<div class="date">${dateStr}</div>
<div style="text-align:center"><span class="badge">${r.categoryLabel}</span></div>

<div class="scores">
  <div class="score-card"><div class="score-num">${r.harmonyScore}%</div><div class="score-lbl">默契度</div></div>
  <div class="score-card"><div class="score-num">${r.resonanceScore}%</div><div class="score-lbl">情感共鸣</div></div>
</div>

<div class="section">
  <div class="section-lbl">AI 情感总结</div>
  <div class="card">${r.aiSummary}</div>
</div>

<div class="divider"></div>

<div class="section">
  <div class="section-lbl">冲突根源</div>
  <div class="card">${r.rootCause}</div>
</div>

<div class="section">
  <div class="section-lbl">触发话题</div>
  <div class="card">${r.triggerTopic}</div>
</div>

${r.mainIssueOwner && r.mainIssueOwner !== 'none' ? `
<div class="issue-card">
  <div style="font-size:12px;color:rgba(255,255,255,0.35);margin-bottom:5px;">主要问题方</div>
  <div class="pink" style="font-size:15px;font-weight:600;">${r.mainIssueOwner==='A'?nameA:r.mainIssueOwner==='B'?nameB:nameA+'和'+nameB}</div>
  ${r.mainIssueReason ? `<div style="font-size:13px;color:rgba(255,255,255,0.45);margin-top:5px;">${r.mainIssueReason}</div>` : ''}
</div>` : ''}

<div class="med-card">
  <div style="font-size:12px;color:rgba(255,255,255,0.35);margin-bottom:6px;">调解建议</div>
  <div class="green" style="font-size:14px;line-height:1.8;">${r.mediationSuggestion}</div>
</div>

<div class="divider"></div>

<div class="section">
  <div class="section-lbl">沟通雷达</div>
  <table class="radar-table">
    <tr><td style="color:rgba(255,255,255,0.3);width:60px;"></td><td style="color:#FF6B9D;font-size:12px;">${nameA}</td><td style="color:#9B7FE8;font-size:12px;">${nameB}</td></tr>
    ${radarRows.map(([lbl, a, b]) => `<tr>
      <td>${lbl}</td>
      <td><div class="radar-bar-bg"><div class="radar-bar-a" style="width:${a}%"></div></div> <span style="font-size:11px;color:rgba(255,255,255,0.4);margin-left:4px">${a}</span></td>
      <td><div class="radar-bar-bg"><div class="radar-bar-b" style="width:${b}%"></div></div> <span style="font-size:11px;color:rgba(255,255,255,0.4);margin-left:4px">${b}</span></td>
    </tr>`).join('')}
  </table>
</div>

<div class="footer">由 LoveSync AI 生成 · 数据仅保存在本地</div>
</body></html>`

    try {
      const { uri } = await Print.printToFileAsync({ html, base64: false })
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'LoveSync 分析报告' })
    } catch (e) {
      Alert.alert('导出失败', '请检查存储权限后重试')
    }
  }

  function fmtTs(s: number) {
    return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`
  }
  function fmtDate(ts: number) {
    const d = new Date(ts)
    return `${d.getMonth()+1}月${d.getDate()}日 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  }
  function fmtDur(s: number) { return `${Math.floor(s/60)}分${s%60}秒` }

  return (
    <>
    <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
      <View style={[styles.screen, { backgroundColor: theme.bg }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={[styles.iconBtn, { backgroundColor: theme.bg4, borderColor: theme.border }]}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <SvgLine x1={18} y1={6} x2={6} y2={18} stroke={theme.text2} strokeWidth={2}/>
              <SvgLine x1={6}  y1={6} x2={18} y2={18} stroke={theme.text2} strokeWidth={2}/>
            </Svg>
          </TouchableOpacity>

          <View style={[styles.tabSwitcher, { backgroundColor: theme.bg3 }]}>
            {(['overview','insight','coach'] as Tab[]).map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.tabBtn, tab===t && { backgroundColor: theme.primary }]}
                onPress={() => setTab(t)}
              >
                <Text style={[styles.tabTxt, { color: theme.text2 }, tab===t && styles.tabTxtActive]}>
                  {t==='overview'?'概览':t==='insight'?'深度洞察':'教练'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: theme.bg4, borderColor: theme.border }]} onPress={handleExport}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" stroke={theme.text2} strokeWidth={1.8} strokeLinecap="round"/>
              <Path d="M16 6l-4-4-4 4" stroke={theme.text2} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
              <SvgLine x1={12} y1={2} x2={12} y2={15} stroke={theme.text2} strokeWidth={1.8} strokeLinecap="round"/>
            </Svg>
          </TouchableOpacity>
        </View>

        <AvatarPair nameA={nameA} nameB={nameB} score={report.harmonyScore} scoreLabel="默契度" avatarA={profile?.avatarA} avatarB={profile?.avatarB} theme={theme}/>
        <Divider theme={theme}/>

        {/* 概览 Tab */}
        {tab === 'overview' && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            <View style={styles.metaRow}>
              <CategoryBadge category={report.category} theme={theme}/>
              <Text style={[styles.metaTxt, { color: theme.text3 }]}>{fmtDate(rec.createdAt)}</Text>
            </View>

            <Card theme={theme}>
              <SectionTitle icon="🧠" title="AI 情感总结"/>
              <Text style={[styles.summaryText, { color: theme.text2 }]}>{report.aiSummary}</Text>
            </Card>

            <Card style={{paddingHorizontal:0,paddingBottom:0}} theme={theme}>
              <View style={{paddingHorizontal:spacing.lg}}>
                <SectionTitle title="情绪心电图"/>
                <Legend items={[{color:theme.primary,label:nameA},{color:theme.secondary,label:nameB}]}/>
              </View>
              <EmotionChart key={`emotion-${tab}`} data={report.emotionTimeline} totalDuration={rec.duration} height={120} theme={theme}/>
              {report.emotionTimeline.find(p => p.isFlashpoint) && (() => {
                const fp = report.emotionTimeline.find(p => p.isFlashpoint)!
                const cp = report.conflictPoints.find(c => Math.abs(c.timestamp - fp.timestamp) < 10)
                return (
                  <View style={[styles.momentCard, { backgroundColor: theme.bg4 }]}>
                    <View style={styles.momentHeader}>
                      <View style={[styles.speakerBadge,{backgroundColor: cp?.speaker==='B'?theme.secondary:theme.primary}]}>
                        <Text style={styles.speakerTxt}>{cp?.speaker==='B'?nameB:nameA}</Text>
                      </View>
                      <Text style={[styles.momentTime, { color: theme.text2 }]}>{fmtTs(fp.timestamp)}</Text>
                    </View>
                    {cp && <Text style={[styles.momentQuote, { color: theme.text }]}>"{cp.text}"</Text>}
                    {fp.highlight && (
                      <View style={styles.aiComment}>
                        <Text style={[styles.aiCommentStar, { color: theme.amber }]}>✦</Text>
                        <Text style={[styles.aiCommentTxt, { color: theme.text2 }]}>AI: {fp.highlight}</Text>
                      </View>
                    )}
                  </View>
                )
              })()}
            </Card>

            {report.conflictPoints.length > 0 && (
              <Card style={{borderColor:theme.red + '40',backgroundColor:theme.red + '12'}} theme={theme}>
                <SectionTitle icon="⚠" title="矛盾爆发点"/>
                {report.conflictPoints.map((c,i) => (
                  <View key={i} style={styles.conflictItem}>
                    <Text style={[styles.conflictTime, { color: theme.red }]}>{fmtTs(c.timestamp)}</Text>
                    <Text style={[styles.conflictText, { color: theme.text2 }]}>"{c.text}"</Text>
                  </View>
                ))}
              </Card>
            )}
          </ScrollView>
        )}

        {/* 深度洞察 Tab */}
        {tab === 'insight' && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            <View style={styles.miniGrid}>
              <Card style={styles.miniCard} theme={theme}>
                <View style={[styles.ringWrap, { borderColor: theme.primary }]}>
                  <Text style={[styles.ringPct, { color: theme.text }]}>{report.resonanceScore}%</Text>
                </View>
                <Text style={[styles.miniLabel, { color: theme.text2 }]}>情感共鸣</Text>
              </Card>
              <Card style={styles.miniCard} theme={theme}>
                <Text style={[styles.trendTitle, { color: theme.text2 }]}>关系成长趋势</Text>
                <TrendRow label="情绪稳定度" direction={report.trend.emotionalStability} theme={theme}/>
                <TrendRow label="争吵频率"   direction={report.trend.conflictFrequency} theme={theme}/>
                <TrendRow label="默契度"     direction={report.trend.harmony} theme={theme}/>
              </Card>
            </View>

            <Card theme={theme}>
              <SectionTitle icon="📡" title="沟通雷达"/>
              <Legend items={[{color:theme.primary,label:nameA},{color:theme.secondary,label:nameB}]}/>
              <RadarChart key={`radar-${tab}`} dataA={report.radar} dataB={report.radarB} size={220} theme={theme}/>
              <View style={[styles.radarInsight, { backgroundColor: theme.bg5 }]}>
                <Text style={[styles.radarInsightStar, { color: theme.amber }]}>✦</Text>
                <Text style={[styles.radarInsightTxt, { color: theme.text2 }]}>{report.radarInsight}</Text>
              </View>
            </Card>

            <Card style={{borderColor:theme.primary + '40'}} theme={theme}>
              <SectionTitle icon="💡" title="冲突根源深挖"/>
              <View style={styles.causeTag}>
                <Text style={[styles.causeTxt, { color: theme.text2 }]}>{report.rootCause}</Text>
              </View>
              <Text style={[styles.triggerLabel, { color: theme.text2 }]}>
                触发话题：<Text style={[styles.triggerVal, { color: theme.text }]}>{report.triggerTopic}</Text>
              </Text>
              <View style={[styles.adviceBox, { backgroundColor: theme.bg4, borderLeftColor: theme.primary }]}>
                <Text style={[styles.adviceTxt, { color: theme.text2 }]}>"{report.advice}"</Text>
              </View>

              {/* 责任占比 */}
              {report.mainIssueOwner && report.mainIssueOwner !== 'none' && (
                <View style={[styles.issueOwnerCard, { borderColor: theme.primary + '33' }]}>
                  <Text style={[styles.issueOwnerTitle, { color: theme.text }]}>
                    🔍 主要问题方：
                    <Text style={{color:theme.primary}}>
                      {report.mainIssueOwner==='A'?nameA:report.mainIssueOwner==='B'?nameB:`${nameA}和${nameB}`}
                    </Text>
                  </Text>
                  {!!report.mainIssueReason && (
                    <Text style={[styles.issueOwnerReason, { color: theme.text2 }]}>{report.mainIssueReason}</Text>
                  )}
                </View>
              )}

              {/* 调解建议 */}
              {!!report.mediationSuggestion && (
                <View style={[styles.mediationCard, { borderColor: theme.green + '40' }]}>
                  <Text style={[styles.mediationTitle, { color: theme.green }]}>🕊️ 调解建议</Text>
                  <Text style={[styles.mediationTxt, { color: theme.text2 }]}>{report.mediationSuggestion}</Text>
                </View>
              )}
            </Card>

            {/* 今日调解任务入口按钮 */}
            <TouchableOpacity
              style={[styles.toTaskBtn, { borderColor: theme.primary + '4d' }]}
              onPress={() => { setShowTaskModal(true); if (tasks.length === 0) generateTasks() }}
              activeOpacity={0.8}
            >
              <Text style={[styles.toTaskBtnTxt, { color: theme.primary }]}>📋 生成今日调解任务</Text>
              <Text style={styles.toTaskBtnSub}>基于本次分析，AI 为你们定制可执行任务</Text>
            </TouchableOpacity>

          </ScrollView>
        )}

        {/* AI 教练 Tab */}
        {tab === 'coach' && (
          <View style={{flex:1}}>
            {/* 话术卡片 */}
            <View style={[styles.phrasesWrap, { borderBottomColor: theme.border }]}>
              <Text style={[styles.phrasesTitle, { color: theme.text2 }]}>💬 破冰话术</Text>
              {loadingPhrases ? (
                <View style={{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:8}}>
                  <ActivityIndicator color={theme.primary} size="small"/>
                  <Text style={{fontSize:12,color:theme.text3}}>AI 生成中…</Text>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}>
                  {phrases.map((p,i) => (
                    <TouchableOpacity key={i} style={[styles.phraseChip, { backgroundColor: theme.bg3, borderColor: theme.border2 }]} onPress={() => setInput(p)}>
                      <Text style={[styles.phraseChipTxt, { color: theme.text }]}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity style={[styles.regenBtn, { borderColor: theme.secondaryDim }]} onPress={() => { setPhrases([]); generatePhrases() }}>
                    <Text style={[styles.regenTxt, { color: theme.secondary }]}>换一批 ↻</Text>
                  </TouchableOpacity>
                </ScrollView>
              )}
            </View>

            {/* 对话列表 */}
            <FlatList
              ref={flatRef}
              data={messages}
              keyExtractor={(_,i) => String(i)}
              contentContainerStyle={styles.chatContent}
              renderItem={({item}) => (
                <View style={[styles.bubble, item.role==='user' ? [styles.bubbleUser, { backgroundColor: theme.primary }] : [styles.bubbleAI, { backgroundColor: theme.bg3, borderColor: theme.border }]]}>
                  {item.role === 'ai' && <Text style={[styles.bubbleRoleTxt, { color: theme.text3 }]}>🤖 AI 调解顾问</Text>}
                  <Text style={[styles.bubbleTxt, { color: theme.text }, item.role==='user' && styles.bubbleTxtUser]}>
                    {item.text}
                  </Text>
                </View>
              )}
              ListFooterComponent={aiTyping ? (
                <View style={[styles.bubble, styles.bubbleAI, { backgroundColor: theme.bg3, borderColor: theme.border }]}>
                  <Text style={[styles.bubbleRoleTxt, { color: theme.text3 }]}>🤖 AI 调解顾问</Text>
                  <Text style={[styles.typingDots, { color: theme.text3 }]}>···</Text>
                </View>
              ) : null}
            />

            {/* 输入框 */}
            <View style={[styles.chatInputRow, { borderTopColor: theme.border, backgroundColor: theme.bg }]}>
              <TextInput
                value={input}
                onChangeText={setInput}
                style={[styles.chatInput, { backgroundColor: theme.bg3, borderColor: theme.border2, color: theme.text }]}
                placeholder="问问 AI 教练…"
                placeholderTextColor={theme.text3}
                multiline
                maxLength={200}
                onSubmitEditing={sendMessage}
              />
              <TouchableOpacity
                style={[styles.sendBtn, { backgroundColor: theme.primary }, (!input.trim()||aiTyping) && {opacity:0.4}]}
                onPress={sendMessage}
                disabled={!input.trim() || aiTyping}
              >
                <Text style={styles.sendBtnTxt}>发送</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>

      {/* 今日调解任务弹窗 */}
      <Modal visible={showTaskModal} transparent animationType="slide" onRequestClose={() => setShowTaskModal(false)}>
        <View style={{flex:1,backgroundColor:'rgba(0,0,0,0.6)',justifyContent:'flex-end'}}>
          <View style={{backgroundColor:theme.bg4,borderTopLeftRadius:24,borderTopRightRadius:24,padding:24,gap:16}}>
            <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
              <Text style={{fontSize:18,fontWeight:'700',color:theme.text}}>今日调解任务</Text>
              <TouchableOpacity onPress={() => setShowTaskModal(false)}>
                <Text style={{fontSize:15,color:theme.text3}}>关闭</Text>
              </TouchableOpacity>
            </View>
            <Text style={{fontSize:13,color:theme.text3}}>AI 基于本次分析生成，双方共同完成</Text>
            {loadingTasks ? (
              <View style={{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:12}}>
                <ActivityIndicator color={theme.primary} size="small"/>
                <Text style={{fontSize:13,color:theme.text3}}>AI 生成中…</Text>
              </View>
            ) : tasks.map((t, i) => (
              <TouchableOpacity key={i}
                style={[styles.taskItem, { backgroundColor: theme.bg3, borderColor: theme.border }, tasksDone[i] && styles.taskItemDone]}
                onPress={() => setTasksDone(prev => prev.map((v, idx) => idx === i ? !v : v))}
                activeOpacity={0.7}
              >
                <View style={[styles.taskCheck, { borderColor: theme.primary }, tasksDone[i] && { backgroundColor: theme.primary, borderColor: theme.primary }]}>
                  {tasksDone[i] && <Text style={{fontSize:10,color:'#fff'}}>✓</Text>}
                </View>
                <Text style={[styles.taskTxt, { color: theme.text }, tasksDone[i] && {textDecorationLine:'line-through',color:theme.text3}]}>{t}</Text>
              </TouchableOpacity>
            ))}
            {tasks.length === 0 && !loadingTasks && (
              <TouchableOpacity
                style={{backgroundColor:theme.primaryDim,borderRadius:12,padding:14,alignItems:'center',borderWidth:1,borderColor:theme.primary + '4d'}}
                onPress={generateTasks}
              >
                <Text style={{fontSize:14,fontWeight:'600',color:theme.primary}}>重新生成</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  screen:  {flex:1,paddingTop:56},
  loading: {flex:1,alignItems:'center',justifyContent:'center'},
  header:  {flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:spacing.md,marginBottom:4},
  iconBtn: {width:36,height:36,borderRadius:18,borderWidth:1,alignItems:'center',justifyContent:'center'},
  tabSwitcher: {flexDirection:'row',borderRadius:24,padding:3},
  tabBtn: {paddingHorizontal:12,paddingVertical:6,borderRadius:21},
  tabTxt: {fontSize:12,fontWeight:'500'},
  tabTxtActive: {color:'#fff'},
  content: {paddingHorizontal:spacing.xxl,paddingBottom:40,gap:14},
  metaRow: {flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingTop:4},
  metaTxt: {fontSize:11},
  summaryText: {fontSize:14,lineHeight:22},
  momentCard: {margin:spacing.md,marginTop:0,borderRadius:12,padding:12},
  momentHeader: {flexDirection:'row',alignItems:'center',gap:8,marginBottom:8},
  speakerBadge: {borderRadius:radius.full,paddingHorizontal:10,paddingVertical:3},
  speakerTxt: {fontSize:12,fontWeight:'600',color:'#fff'},
  momentTime: {fontSize:12},
  momentQuote: {fontSize:13,lineHeight:20,marginBottom:8},
  aiComment: {flexDirection:'row',gap:6,alignItems:'flex-start'},
  aiCommentStar: {fontSize:12,marginTop:1},
  aiCommentTxt: {fontSize:12,flex:1,lineHeight:18},
  conflictItem: {flexDirection:'row',gap:12,marginBottom:10,alignItems:'flex-start'},
  conflictTime: {fontSize:12,fontWeight:'600',minWidth:40,marginTop:2},
  conflictText: {fontSize:13,flex:1,lineHeight:20},
  miniGrid: {flexDirection:'row',gap:12},
  miniCard: {flex:1,alignItems:'center'},
  ringWrap: {width:70,height:70,borderRadius:35,borderWidth:4,alignItems:'center',justifyContent:'center',marginBottom:6},
  ringPct: {fontSize:18,fontWeight:'700'},
  miniLabel: {fontSize:11},
  trendTitle: {fontSize:12,textAlign:'center',marginBottom:8},
  radarInsight: {flexDirection:'row',gap:6,borderRadius:10,padding:10,marginTop:12},
  radarInsightStar: {fontSize:13},
  radarInsightTxt: {fontSize:13,flex:1},
  causeTag: {backgroundColor:'rgba(255,107,157,0.1)',borderRadius:10,padding:12,marginBottom:10,borderWidth:1,borderColor:'rgba(255,107,157,0.25)'},
  causeTxt: {fontSize:13,lineHeight:20},
  triggerLabel: {fontSize:13,marginBottom:10,lineHeight:20},
  triggerVal: {fontWeight:'500'},
  adviceBox: {borderRadius:10,padding:14,borderLeftWidth:2},
  adviceTxt: {fontSize:13,lineHeight:22},
  issueOwnerCard: {backgroundColor:'rgba(255,107,157,0.08)',borderRadius:radius.md,borderWidth:1,padding:12,marginTop:10},
  issueOwnerTitle: {fontSize:13,fontWeight:'600',marginBottom:4},
  issueOwnerReason: {fontSize:12,lineHeight:18},
  mediationCard: {backgroundColor:'rgba(76,175,125,0.08)',borderRadius:radius.md,borderWidth:1,padding:12,marginTop:10},
  mediationTitle: {fontSize:13,fontWeight:'600',marginBottom:6},
  mediationTxt: {fontSize:13,lineHeight:20},
  // 话术
  phrasesWrap: {paddingHorizontal:spacing.xxl,paddingVertical:12,borderBottomWidth:1,gap:8},
  phrasesTitle: {fontSize:12,fontWeight:'600'},
  phraseChip: {borderRadius:radius.full,borderWidth:1,paddingHorizontal:14,paddingVertical:8,maxWidth:220},
  phraseChipTxt: {fontSize:12,lineHeight:18},
  regenBtn: {backgroundColor:'rgba(155,127,232,0.15)',borderRadius:radius.full,borderWidth:1,paddingHorizontal:14,paddingVertical:8},
  regenTxt: {fontSize:12},
  // 聊天
  chatContent: {paddingHorizontal:spacing.xxl,paddingVertical:16,gap:12,paddingBottom:20},
  bubble: {maxWidth:'85%',borderRadius:16,padding:14,gap:4},
  bubbleAI: {alignSelf:'flex-start',borderWidth:1,borderBottomLeftRadius:4},
  bubbleUser: {alignSelf:'flex-end',borderBottomRightRadius:4},
  bubbleRoleTxt: {fontSize:11,marginBottom:2},
  bubbleTxt: {fontSize:14,lineHeight:22},
  bubbleTxtUser: {color:'#fff'},
  typingDots: {fontSize:20,letterSpacing:4},
  chatInputRow: {flexDirection:'row',gap:8,paddingHorizontal:spacing.xxl,paddingVertical:12,borderTopWidth:1},
  chatInput: {flex:1,borderRadius:radius.lg,borderWidth:1,paddingHorizontal:14,paddingVertical:10,fontSize:14,maxHeight:100},
  sendBtn: {borderRadius:radius.lg,paddingHorizontal:16,justifyContent:'center'},
  sendBtnTxt: {fontSize:14,fontWeight:'600',color:'#fff'},
  tasksWrap:      {paddingHorizontal:spacing.xxl,paddingVertical:12,borderBottomWidth:1,gap:8},
  tasksTitle:     {fontSize:12,fontWeight:'600',marginBottom:4},
  taskItem:       {flexDirection:'row',alignItems:'center',gap:10,borderRadius:radius.md,padding:12,borderWidth:1},
  taskItemDone:   {opacity:0.6},
  taskCheck:      {width:20,height:20,borderRadius:10,borderWidth:1.5,alignItems:'center',justifyContent:'center'},
  taskTxt:        {fontSize:13,flex:1,lineHeight:20},
  toTaskBtn:    {backgroundColor:'rgba(255,107,157,0.1)',borderRadius:radius.lg,borderWidth:1,padding:16,alignItems:'center',gap:6},
  toTaskBtnTxt: {fontSize:15,fontWeight:'600'},
  toTaskBtnSub: {fontSize:12,textAlign:'center'},
})
