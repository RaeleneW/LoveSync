// app/(tabs)/record.tsx — 三种输入模式
import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  Alert, ScrollView, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native'
import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import * as DocumentPicker from 'expo-document-picker'
import { spacing, radius } from '../../constants/theme'
import { useTheme } from '../../contexts/ThemeContext'
import {
  requestMicPermission, startRecording, stopRecording,
  getMockTranscript, transcribeAudio,
} from '../../services/audio'
import { analyzeConversation, type TranscriptLine } from '../../services/analyzer'
import { saveRecord, generateId, loadProfile, addXP } from '../../services/storage'
import { loadLLMConfig, chatCompletion } from '../../services/llm'
import Svg, { Path, Line } from 'react-native-svg'

type InputMode = 'record' | 'upload' | 'text'
type Phase = 'idle' | 'recording' | 'analyzing' | 'done' | 'error'

const STEPS = ['正在识别说话人…','分析情绪走势…','计算默契度…','生成深度洞察…','报告生成完毕 ✓']

const MODE_CONFIG = {
  record: { label: '实时录音', desc: '两人对话，AI 实时分析' },
  upload: { label: '上传音频', desc: '导入录好的音频文件' },
  text:   { label: '文字描述', desc: '描述事件，AI 中立分析' },
}

function ModeIcon({ mode, active, activeColor }: { mode: string; active: boolean; activeColor: string }) {
  const c = active ? '#FFFFFF' : 'rgba(255,255,255,0.4)'
  if (mode === 'record') return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" stroke={c} strokeWidth={1.8} strokeLinecap="round"/>
      <Path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke={c} strokeWidth={1.8} strokeLinecap="round"/>
      <Line x1={12} y1={19} x2={12} y2={23} stroke={c} strokeWidth={1.8} strokeLinecap="round"/>
      <Line x1={8}  y1={23} x2={16} y2={23} stroke={c} strokeWidth={1.8} strokeLinecap="round"/>
    </Svg>
  )
  if (mode === 'upload') return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke={c} strokeWidth={1.8} strokeLinecap="round"/>
      <Path d="M17 8l-5-5-5 5" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
      <Line x1={12} y1={3} x2={12} y2={15} stroke={c} strokeWidth={1.8} strokeLinecap="round"/>
    </Svg>
  )
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke={c} strokeWidth={1.8} strokeLinecap="round"/>
      <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke={c} strokeWidth={1.8} strokeLinecap="round"/>
    </Svg>
  )
}

function BreathingRings({ active, color }: { active: boolean; color: string }) {
  const anims = [0, 1, 2].map(() => React.useRef(new Animated.Value(0)).current)
  React.useEffect(() => {
    if (!active) { anims.forEach(a => a.setValue(0)); return }
    const speed = active ? 1200 : 1800
    const makeLoop = (anim: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: speed, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]))
    const loops = anims.map((a, i) => makeLoop(a, i * (speed / 3)))
    loops.forEach(l => l.start())
    return () => loops.forEach(l => l.stop())
  }, [active])
  const sizes = [140, 120, 100]
  const opacities = [color + '26', color + '40', color + '59'] // 15%, 25%, 35% opacity
  return (
    <>
      {anims.map((anim, i) => (
        <Animated.View key={i} style={{
          position: 'absolute',
          width: sizes[i], height: sizes[i], borderRadius: sizes[i] / 2,
          backgroundColor: opacities[i],
          opacity: anim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }),
          transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.4] }) }],
        }}/>
      ))}
    </>
  )
}

export default function RecordScreen() {
  const { theme } = useTheme()
  const [mode, setMode]         = useState<InputMode>('record')
  const [phase, setPhase]       = useState<Phase>('idle')
  const [seconds, setSeconds]   = useState(0)
  const [stepIdx, setStepIdx]   = useState(0)
  const [savedId, setSavedId]   = useState<string | null>(null)
  const [error, setError]       = useState('')
  const [useMock, setUseMock]   = useState(false)
  // 文字模式
  const [textA, setTextA]       = useState('')  // A的描述
  const [textB, setTextB]       = useState('')  // B的描述
  const [textMode, setTextMode] = useState<'both'|'single'>('both')
  // 上传模式
  const [uploadedFile, setUploadedFile] = useState<{ name: string; uri: string } | null>(null)

  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null)
  const stepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const waveAnims    = useRef(Array.from({ length: 12 }, () => new Animated.Value(0.2))).current
  const pulseAnim    = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (phase !== 'recording') {
      waveAnims.forEach(a => Animated.timing(a, { toValue: 0.2, duration: 300, useNativeDriver: false }).start())
      return
    }
    const loops = waveAnims.map((a, i) =>
      Animated.loop(Animated.sequence([
        Animated.delay(i * 60),
        Animated.timing(a, { toValue: 0.25 + Math.random() * 0.75, duration: 250 + i * 30, useNativeDriver: false }),
        Animated.timing(a, { toValue: 0.15 + Math.random() * 0.4, duration: 200 + i * 25, useNativeDriver: false }),
      ]))
    )
    loops.forEach(l => l.start())
    return () => loops.forEach(l => l.stop())
  }, [phase])



  useEffect(() => {
    if (phase === 'analyzing') {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]))
      loop.start()
      return () => { loop.stop(); pulseAnim.setValue(1) }
    }
    pulseAnim.setValue(1)
  }, [phase])

  useEffect(() => {
    if (phase !== 'analyzing') { setStepIdx(0); return }
    let i = 0
    stepTimerRef.current = setInterval(() => { i++; if (i < STEPS.length) setStepIdx(i) }, 1200)
    return () => { if (stepTimerRef.current) clearInterval(stepTimerRef.current) }
  }, [phase])

  useEffect(() => {
    if (phase !== 'recording') { timerRef.current && clearInterval(timerRef.current); return }
    setSeconds(0)
    timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
    return () => { timerRef.current && clearInterval(timerRef.current) }
  }, [phase])

  function fmtTime(s: number) {
    return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`
  }

  function reset() {
    setPhase('idle'); setSavedId(null); setError('')
    setUseMock(false); setUploadedFile(null)
    setTextA(''); setTextB('')
  }

  async function checkAPIKey(): Promise<'ok' | 'demo' | 'cancel'> {
    const cfg = await loadLLMConfig()
    if (!cfg?.apiKey) {
      return new Promise(resolve => {
        Alert.alert('尚未配置 API Key', '请前往"我的"页面配置。\n\n是否先用演示数据体验？', [
          { text: '去配置', onPress: () => { router.push('/(tabs)/profile'); resolve('cancel') } },
          { text: '演示模式', onPress: () => { setUseMock(true); resolve('demo') } },
          { text: '取消', style: 'cancel', onPress: () => resolve('cancel') },
        ])
      })
    }
    return 'ok'
  }

  // ── 录音模式 ─────────────────────────────────────────────────
  async function handleMicPress() {
    if (phase === 'idle') {
      const granted = await requestMicPermission()
      if (!granted) { Alert.alert('需要麦克风权限', '请在系统设置中允许'); return }
      const keyResult = await checkAPIKey()
      if (keyResult === 'cancel') return
      await startRecording()
      setPhase('recording')
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    } else if (phase === 'recording') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
      const result = await stopRecording()
      if (!result || result.duration < 1) { setPhase('idle'); Alert.alert('录音太短'); return }
      setPhase('analyzing')
      runAnalysis({ type: 'audio', uri: result.uri, duration: result.duration })
    }
  }

  // ── 上传音频 ─────────────────────────────────────────────────
  async function handlePickFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*', 'video/*'],
        copyToCacheDirectory: true,
      })
      if (result.canceled) return
      const file = result.assets[0]
      setUploadedFile({ name: file.name, uri: file.uri })
    } catch (e) {
      Alert.alert('选择文件失败', '请选择音频文件')
    }
  }

  async function handleUploadAnalyze() {
    if (!uploadedFile) { Alert.alert('请先选择音频文件'); return }
    const keyResult = await checkAPIKey()
    if (keyResult === 'cancel') return
    setPhase('analyzing')
    runAnalysis({ type: 'audio', uri: uploadedFile.uri, duration: 0 })
  }

  // ── 文字描述模式 ─────────────────────────────────────────────
  async function handleTextAnalyze() {
    if (textMode === 'both' && (!textA.trim() || !textB.trim())) {
      Alert.alert('请填写双方的描述'); return
    }
    if (textMode === 'single' && !textA.trim()) {
      Alert.alert('请填写事件描述'); return
    }
    const keyResult = await checkAPIKey()
    if (keyResult === 'cancel') return
    setPhase('analyzing')
    runAnalysis({ type: 'text', textA: textA.trim(), textB: textB.trim(), mode: textMode })
  }

  // ── 统一分析入口 ─────────────────────────────────────────────
  async function runAnalysis(input:
    | { type: 'audio'; uri: string; duration: number }
    | { type: 'text'; textA: string; textB: string; mode: 'both' | 'single' }
  ) {
    try {
      const profile = await loadProfile()
      const nameA = profile?.nameA ?? '伴侣A'
      const nameB = profile?.nameB ?? '伴侣B'
      let transcript: TranscriptLine[]
      let duration = 0

      if (useMock) {
        await new Promise(r => setTimeout(r, 2500))
        transcript = getMockTranscript(nameA, nameB)
      } else if (input.type === 'audio') {
        duration = input.duration
        transcript = await transcribeAudio(input.uri, nameA, nameB)
      } else {
        // 文字模式：把描述转成对话稿
        transcript = await textToTranscript(input.textA, input.textB, nameA, nameB, input.mode)
      }

      const report = await analyzeConversation(transcript, nameA, nameB)
      const id = generateId()
      await saveRecord({ id, createdAt: Date.now(), duration, report })
      await addXP(50)
      setSavedId(id)
      setPhase('done')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (e: any) {
      setError(e?.message ?? '分析失败，请重试')
      setPhase('error')
    }
  }

  // 文字描述→对话稿转换
  async function textToTranscript(
    textA: string, textB: string,
    nameA: string, nameB: string,
    mode: 'both' | 'single'
  ): Promise<TranscriptLine[]> {
    const prompt = mode === 'both'
      ? `以下是一对情侣各自对同一件事的陈述：\n\n${nameA}说：${textA}\n\n${nameB}说：${textB}\n\n请将上述内容转换为自然的对话格式，每行一句，格式为"说话人：内容"，尽量保留双方的原意和情绪，适当补充合理的对话细节。只输出对话，不要其他内容。`
      : `以下是${nameA}对一件事的单方面陈述：\n\n${textA}\n\n请基于这个陈述，以中立视角推断双方可能的对话，${nameB}的回应要符合常理，不要刻意偏向任何一方。每行一句，格式为"说话人：内容"。只输出对话，不要其他内容。`

    const res = await chatCompletion(
      [{ role: 'user', content: prompt }],
      null,
      { maxTokens: 800, temperature: 0.6 }
    )

    const lines = res.content.split('\n').filter(l => l.trim())
    const result: TranscriptLine[] = []
    let t = 0
    for (const line of lines) {
      const isA = line.startsWith(nameA) || line.startsWith('A：') || line.startsWith('A:')
      const isB = line.startsWith(nameB) || line.startsWith('B：') || line.startsWith('B:')
      const text = line.replace(/^[^：:]+[：:]/, '').trim()
      if (text) {
        result.push({ speaker: isB ? 'B' : 'A', timestamp: t, text })
        t += 10
      }
    }
    return result.length > 0 ? result : [
      { speaker: 'A', timestamp: 0, text: textA },
      { speaker: 'B', timestamp: 10, text: textB || '（对方未提供陈述）' },
    ]
  }

  const isActive    = phase === 'recording'
  const isAnalyzing = phase === 'analyzing'
  const isDone      = phase === 'done'

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[s.screen, { backgroundColor: theme.bg }]}>
        <LinearGradient
          colors={theme.gradientPrimary as any}
          style={StyleSheet.absoluteFill} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.6 }}
        />

        {/* Header */}
        <View style={s.header}>
          <View style={[s.liveBadge, { backgroundColor: theme.bg3 }]}>
            <View style={[s.liveDot, { backgroundColor: isActive ? theme.primary : theme.text3 }]} />
            <Text style={[s.liveTxt, { color: theme.text2 }]}>LOVESYNC {isActive ? '录制中' : '就绪'}</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* 模式切换（仅 idle/done/error 时显示）*/}
          {(phase === 'idle' || phase === 'done' || phase === 'error') && (
            <View style={[s.modeRow, { backgroundColor: theme.bg3, borderColor: theme.border }]}>
              {(Object.keys(MODE_CONFIG) as InputMode[]).map(m => (
                <TouchableOpacity
                  key={m}
                  style={[s.modeBtn, mode === m && { backgroundColor: theme.primary }]}
                  onPress={() => { setMode(m); reset() }}
                >
                  <ModeIcon mode={m} active={mode === m} activeColor={theme.primary} />
                  <Text style={[s.modeTxt, { color: theme.text2 }, mode === m && { color: '#fff', fontWeight: '700' }]}>{MODE_CONFIG[m].label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ── 录音模式 ── */}
          {mode === 'record' && (
            <View style={[s.panel, { backgroundColor: theme.bg4, borderColor: theme.border2 }]}>
              {isActive && <Text style={[s.timer, { color: theme.text }]}>{fmtTime(seconds)}</Text>}
              {isActive && (
                <View style={s.waveform}>
                  {waveAnims.map((anim, i) => (
                    <Animated.View key={i} style={[s.wavebar, { backgroundColor: theme.primary }, {
                      height: anim.interpolate({ inputRange:[0,1], outputRange:[4,52] }),
                      opacity: anim.interpolate({ inputRange:[0,1], outputRange:[0.4,1] }),
                    }]} />
                  ))}
                </View>
              )}
              {isAnalyzing && (
                <Animated.View style={[s.ring, { backgroundColor: theme.secondaryDim, borderColor: theme.secondary }, { transform:[{scale:pulseAnim}] }]}>
                  <Text style={s.bigEmoji}>🧠</Text>
                </Animated.View>
              )}
              {isDone && <View style={[s.ring, { backgroundColor: theme.green + '33', borderColor: theme.green + '66' }]}><Text style={[s.bigEmoji,{color:theme.green}]}>✓</Text></View>}
              {phase === 'error' && (
                <View style={{alignItems:'center',gap:8}}>
                  <Text style={s.bigEmoji}>⚠</Text>
                  <Text style={[s.errorTxt, { color: theme.red }]}>{error}</Text>
                </View>
              )}
              {(phase === 'idle' || phase === 'recording') && (
                <View style={{ alignItems:'center', justifyContent:'center', width:160, height:160 }}>
                  <BreathingRings active={phase === 'idle' || phase === 'recording'} color={theme.primary} />
                  <TouchableOpacity style={[s.micRing, isActive && { backgroundColor: theme.primaryDim, borderColor: theme.primary }]} onPress={handleMicPress} activeOpacity={0.8}>
                    <Svg width={44} height={44} viewBox="0 0 24 24" fill="none">
                      <Path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" stroke={isActive?'#fff':theme.primary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
                      <Path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke={isActive?'#fff':theme.primary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
                      <Line x1={12} y1={19} x2={12} y2={23} stroke={isActive?'#fff':theme.primary} strokeWidth={1.8} strokeLinecap="round"/>
                      <Line x1={8} y1={23} x2={16} y2={23} stroke={isActive?'#fff':theme.primary} strokeWidth={1.8} strokeLinecap="round"/>
                    </Svg>
                  </TouchableOpacity>
                </View>
              )}
              <Text style={[s.panelTitle, { color: theme.text }]}>
                {phase==='idle'?'点击开始录音':phase==='recording'?'再次点击结束':phase==='analyzing'?'AI 分析中…':phase==='done'?'分析完成！':'发生错误'}
              </Text>
              <Text style={[s.panelSub, { color: theme.text2 }]}>
                {phase==='analyzing' ? STEPS[stepIdx] : MODE_CONFIG.record.desc}
              </Text>
              {phase === 'idle' && (
                <View style={[s.aiReady, { backgroundColor: theme.green + '1a', borderColor: theme.green + '40' }]}>
                  <View style={[s.aiDot, { backgroundColor: theme.green }]}/><Text style={[s.aiTxt, { color: theme.green }]}>AI 模型就绪</Text>
                </View>
              )}
            </View>
          )}

          {/* ── 上传音频模式 ── */}
          {mode === 'upload' && (
            <View style={[s.panel, { backgroundColor: theme.bg4, borderColor: theme.border2 }]}>
              {isAnalyzing && (
                <Animated.View style={[s.ring, { backgroundColor: theme.secondaryDim, borderColor: theme.secondary }, { transform:[{scale:pulseAnim}] }]}>
                  <Text style={s.bigEmoji}>🧠</Text>
                </Animated.View>
              )}
              {isDone && <View style={[s.ring, { backgroundColor: theme.green + '33', borderColor: theme.green + '66' }]}><Text style={[s.bigEmoji,{color:theme.green}]}>✓</Text></View>}
              {phase === 'error' && (
                <View style={{alignItems:'center',gap:8}}>
                  <Text style={s.bigEmoji}>⚠</Text>
                  <Text style={[s.errorTxt, { color: theme.red }]}>{error}</Text>
                </View>
              )}
              {phase === 'idle' && (
                <>
                  <TouchableOpacity style={[s.uploadArea, { borderColor: theme.border2 }]} onPress={handlePickFile} activeOpacity={0.8}>
                    <Text style={{fontSize:40,marginBottom:12}}>📁</Text>
                    {uploadedFile ? (
                      <>
                        <Text style={[s.uploadFileName, { color: theme.primary }]}>{uploadedFile.name}</Text>
                        <Text style={[s.uploadHint, { color: theme.text3 }]}>点击重新选择</Text>
                      </>
                    ) : (
                      <>
                        <Text style={[s.uploadTitle, { color: theme.text }]}>选择音频文件</Text>
                        <Text style={[s.uploadHint, { color: theme.text3 }]}>支持 mp3 · m4a · wav · aac</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  {uploadedFile && (
                    <TouchableOpacity style={[s.analyzeBtn, { backgroundColor: theme.primary }]} onPress={handleUploadAnalyze}>
                      <Text style={s.analyzeBtnTxt}>开始分析 →</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
              {phase === 'analyzing' && (
                <>
                  <Text style={[s.panelTitle, { color: theme.text }]}>AI 分析中…</Text>
                  <Text style={[s.panelSub, { color: theme.text2 }]}>{STEPS[stepIdx]}</Text>
                </>
              )}
            </View>
          )}

          {/* ── 文字描述模式 ── */}
          {mode === 'text' && (
            <View style={{gap:12}}>
              {isAnalyzing && (
                <View style={[s.panel, { backgroundColor: theme.bg4, borderColor: theme.border2 }]}>
                  <Animated.View style={[s.ring, { backgroundColor: theme.secondaryDim, borderColor: theme.secondary }, { transform:[{scale:pulseAnim}] }]}>
                    <Text style={s.bigEmoji}>🧠</Text>
                  </Animated.View>
                  <Text style={[s.panelTitle, { color: theme.text }]}>AI 分析中…</Text>
                  <Text style={[s.panelSub, { color: theme.text2 }]}>{STEPS[stepIdx]}</Text>
                </View>
              )}
              {isDone && (
                <View style={[s.panel, { backgroundColor: theme.bg4, borderColor: theme.border2 }]}>
                  <View style={[s.ring, { backgroundColor: theme.green + '33', borderColor: theme.green + '66' }]}><Text style={[s.bigEmoji,{color:theme.green}]}>✓</Text></View>
                  <Text style={[s.panelTitle, { color: theme.text }]}>分析完成！</Text>
                </View>
              )}
              {phase === 'error' && (
                <View style={[s.panel, { backgroundColor: theme.bg4, borderColor: theme.border2 }]}>
                  <Text style={s.bigEmoji}>⚠</Text>
                  <Text style={[s.errorTxt, { color: theme.red }]}>{error}</Text>
                </View>
              )}
              {phase === 'idle' && (
                <>
                  {/* 双人/单人切换 */}
                  <View style={[s.textModeSwitch, { backgroundColor: theme.bg3, borderColor: theme.border }]}>
                    <TouchableOpacity
                      style={[s.textModeBtn, textMode==='both' && { backgroundColor: theme.primary }]}
                      onPress={() => setTextMode('both')}>
                      <Text style={[s.textModeTxt, { color: theme.text2 }, textMode==='both' && { color: '#fff' }]}>双方各自描述</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.textModeBtn, textMode==='single' && { backgroundColor: theme.primary }]}
                      onPress={() => setTextMode('single')}>
                      <Text style={[s.textModeTxt, { color: theme.text2 }, textMode==='single' && { color: '#fff' }]}>单人描述事件</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={[s.textCard, { backgroundColor: theme.bg3, borderColor: theme.border }]}>
                    <Text style={[s.textLabel, { color: theme.text }]}>
                      {textMode==='both' ? '你的感受和陈述' : '描述事件经过'}
                    </Text>
                    <Text style={[s.textHint, { color: theme.text3 }]}>
                      {textMode==='both'
                        ? '尽量详细描述你的感受、对方说了什么、你怎么回应的'
                        : 'AI 会从中立视角分析，并推断双方可能的心理'}
                    </Text>
                    <TextInput
                      value={textA}
                      onChangeText={setTextA}
                      style={[s.textInput, { backgroundColor: theme.bg4, borderColor: theme.border2, color: theme.text }]}
                      placeholder={textMode==='both'
                        ? '例：今天我叫他帮我拿东西，他说不重不用拿，我觉得他就是懒，一点都不体贴…'
                        : '例：今天我和对象因为一件小事起了争执，事情是这样的…'}
                      placeholderTextColor={theme.text3}
                      multiline
                      numberOfLines={5}
                      textAlignVertical="top"
                    />
                  </View>

                  {textMode === 'both' && (
                    <View style={[s.textCard, { backgroundColor: theme.bg3, borderColor: theme.border }]}>
                      <Text style={[s.textLabel, { color: theme.text }]}>TA 的感受和陈述</Text>
                      <Text style={[s.textHint, { color: theme.text3 }]}>让对方来填写，或者你来描述对方的立场</Text>
                      <TextInput
                        value={textB}
                        onChangeText={setTextB}
                        style={[s.textInput, { backgroundColor: theme.bg4, borderColor: theme.border2, color: theme.text }]}
                        placeholder="例：我觉得那个东西确实不重，而且她平时也喜欢自己拿，我没想到她会介意…"
                        placeholderTextColor={theme.text3}
                        multiline
                        numberOfLines={5}
                        textAlignVertical="top"
                      />
                    </View>
                  )}

                  <TouchableOpacity style={[s.analyzeBtn, { backgroundColor: theme.primary }]} onPress={handleTextAnalyze}>
                    <Text style={s.analyzeBtnTxt}>🔍 开始分析</Text>
                  </TouchableOpacity>

                  <View style={[s.tipCard, { backgroundColor: theme.secondaryDim, borderColor: theme.secondary + '40' }]}>
                    <Text style={[s.tipTxt, { color: theme.text2 }]}>
                      💡 描述越详细，分析越准确。可以包括：说了什么话、当时的语气、事情的背景、你的感受。
                    </Text>
                  </View>
                </>
              )}
            </View>
          )}

          {/* 结果按钮 */}
          {isDone && savedId && (
            <View style={{gap:10}}>
              <TouchableOpacity style={[s.analyzeBtn, { backgroundColor: theme.primary }]} onPress={() => router.push(`/report/${savedId}`)}>
                <Text style={s.analyzeBtnTxt}>查看报告 →</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.ghostBtn, { borderColor: theme.border2 }]} onPress={reset}>
                <Text style={[s.ghostBtnTxt, { color: theme.text2 }]}>再分析一次</Text>
              </TouchableOpacity>
            </View>
          )}
          {phase === 'error' && (
            <TouchableOpacity style={[s.ghostBtn, { borderColor: theme.border2 }]} onPress={reset}>
              <Text style={[s.ghostBtnTxt, { color: theme.text2 }]}>重试</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  screen: {flex:1},
  header: {paddingTop:64,paddingHorizontal:spacing.xxl,paddingBottom:8},
  liveBadge: {flexDirection:'row',alignItems:'center',gap:6,alignSelf:'flex-start',borderRadius:radius.full,paddingHorizontal:12,paddingVertical:5},
  liveDot: {width:7,height:7,borderRadius:3.5},
  liveTxt: {fontSize:12},
  content: {paddingHorizontal:spacing.xxl,paddingBottom:40,gap:14},
  // 模式切换
  modeRow: {flexDirection:'row',borderRadius:radius.lg,borderWidth:1,padding:4,gap:4},
  modeBtn: {flex:1,alignItems:'center',paddingVertical:10,borderRadius:radius.md,gap:3},
  modeTxt: {fontSize:11,fontWeight:'500'},
  // 面板
  panel: {borderRadius:28,borderWidth:1,padding:36,alignItems:'center',gap:16,minHeight:240},
  timer: {fontSize:40,fontWeight:'700'},
  waveform: {flexDirection:'row',alignItems:'center',gap:4,height:60},
  wavebar: {width:4,borderRadius:2},
  ring: {width:88,height:88,borderRadius:44,alignItems:'center',justifyContent:'center',borderWidth:1},
  bigEmoji: {fontSize:36},
  errorTxt: {fontSize:13,textAlign:'center'},
  micRing: {width:100,height:100,borderRadius:50,borderWidth:1,alignItems:'center',justifyContent:'center'},
  panelTitle: {fontSize:22,fontWeight:'700'},
  panelSub: {fontSize:13,textAlign:'center'},
  aiReady: {flexDirection:'row',alignItems:'center',gap:6,borderRadius:radius.full,paddingHorizontal:12,paddingVertical:5,borderWidth:1},
  aiDot: {width:6,height:6,borderRadius:3},
  aiTxt: {fontSize:11},
  // 上传
  uploadArea: {width:'100%',borderRadius:16,borderWidth:2,borderStyle:'dashed',padding:28,alignItems:'center',gap:6},
  uploadTitle: {fontSize:18,fontWeight:'600'},
  uploadFileName: {fontSize:14,fontWeight:'500',textAlign:'center'},
  uploadHint: {fontSize:12},
  // 文字模式
  textModeSwitch: {flexDirection:'row',borderRadius:radius.lg,borderWidth:1,padding:3,gap:3},
  textModeBtn: {flex:1,paddingVertical:9,borderRadius:radius.md,alignItems:'center'},
  textModeTxt: {fontSize:13,fontWeight:'500'},
  textCard: {borderRadius:radius.xl,borderWidth:1,padding:spacing.lg,gap:8},
  textLabel: {fontSize:14,fontWeight:'600'},
  textHint: {fontSize:12,lineHeight:18},
  textInput: {borderRadius:radius.sm,borderWidth:1,padding:12,fontSize:14,minHeight:110,lineHeight:22},
  tipCard: {borderRadius:radius.md,borderWidth:1,padding:12},
  tipTxt: {fontSize:12,lineHeight:20},
  // 按钮
  analyzeBtn: {borderRadius:radius.md,paddingVertical:14,alignItems:'center'},
  analyzeBtnTxt: {fontSize:16,fontWeight:'600',color:'#fff'},
  ghostBtn: {borderRadius:radius.md,borderWidth:1,paddingVertical:13,alignItems:'center'},
  ghostBtnTxt: {fontSize:15},
})
