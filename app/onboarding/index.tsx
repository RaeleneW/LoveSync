// app/onboarding/index.tsx
import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { colors, spacing, radius } from '../../constants/theme'
import { saveProfile } from '../../services/storage'
import { saveLLMConfig, PRESET_MODELS, type ModelProvider } from '../../services/llm'

type Step = 0 | 1 | 2

export default function OnboardingScreen() {
  const [step, setStep]       = useState<Step>(0)
  const [nameA, setNameA]     = useState('')
  const [nameB, setNameB]     = useState('')
  const [provider, setProvider] = useState<ModelProvider>('openai')
  const [model, setModel]     = useState('gpt-4o-mini')
  const [apiKey, setApiKey]   = useState('')
  const [showKey, setShowKey] = useState(false)

  const preset = PRESET_MODELS.find(p => p.provider === provider)!

  async function finish() {
    await saveProfile({ nameA: nameA.trim() || '小A', nameB: nameB.trim() || '小B', createdAt: Date.now() })
    if (apiKey.trim()) {
      await saveLLMConfig({ provider, model, apiKey: apiKey.trim(), baseURL: preset.baseURL })
    }
    router.replace('/(tabs)')
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <LinearGradient
          colors={['rgba(155,127,232,0.3)', 'rgba(180,40,80,0.2)', 'transparent']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.7 }}
        />

        {/* Logo */}
        <View style={styles.logoWrap}>
          <Text style={styles.logoEmoji}>💞</Text>
          <Text style={styles.logoTitle}>LoveSync</Text>
          <Text style={styles.logoSub}>AI 情感判官</Text>
        </View>

        {/* Step indicators */}
        <View style={styles.steps}>
          {[0, 1, 2].map(i => (
            <View key={i} style={[styles.stepDot, step === i && styles.stepDotActive, step > i && styles.stepDotDone]} />
          ))}
        </View>

        {/* Step 0: Welcome */}
        {step === 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>欢迎使用 LoveSync</Text>
            <Text style={styles.cardDesc}>
              录下你们的对话，AI 帮你分析情感磁场、找出矛盾根源、给出改善建议。{'\n\n'}
              所有数据存储在你的手机本地，完全私密。
            </Text>
            <View style={styles.features}>
              {['🎙️  录制对话，AI 实时分析', '📡  沟通雷达 & 情绪心电图', '💡  冲突根源深挖 & 改善建议', '🎮  情侣小游戏，解锁成就', '🔒  零服务器，数据完全私密'].map((f, i) => (
                <Text key={i} style={styles.featureItem}>{f}</Text>
              ))}
            </View>
            <TouchableOpacity style={styles.btnPrimary} onPress={() => setStep(1)}>
              <Text style={styles.btnPrimaryTxt}>开始设置 →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Step 1: Names */}
        {step === 1 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>你们叫什么？</Text>
            <Text style={styles.cardDesc}>填写你们的昵称，AI 分析报告里会用到。</Text>
            <View style={{ gap: 12 }}>
              <View>
                <Text style={styles.inputLabel}>你的昵称</Text>
                <TextInput
                  value={nameA} onChangeText={setNameA}
                  style={styles.input} placeholder="例如：小刘"
                  placeholderTextColor={colors.text3}
                  autoFocus
                />
              </View>
              <View>
                <Text style={styles.inputLabel}>TA 的昵称</Text>
                <TextInput
                  value={nameB} onChangeText={setNameB}
                  style={styles.input} placeholder="例如：小曹"
                  placeholderTextColor={colors.text3}
                />
              </View>
            </View>
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.btnGhost} onPress={() => setStep(0)}>
                <Text style={styles.btnGhostTxt}>← 返回</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnPrimary, { flex: 1 }]} onPress={() => setStep(2)}>
                <Text style={styles.btnPrimaryTxt}>下一步 →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Step 2: API Key */}
        {step === 2 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>配置 AI 模型</Text>
            <Text style={styles.cardDesc}>
              选择你要使用的 AI 服务，填入 API Key。{'\n'}
              <Text style={{ color: colors.text3 }}>Key 只存在手机本地，不上传任何服务器。</Text>
            </Text>

            {/* Provider select */}
            <Text style={styles.inputLabel}>选择 AI 服务商</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
              {PRESET_MODELS.map(p => (
                <TouchableOpacity
                  key={p.provider}
                  style={[styles.providerPill, provider === p.provider && styles.providerPillActive]}
                  onPress={() => { setProvider(p.provider); setModel(p.models[0] ?? '') }}
                >
                  <Text style={[styles.providerTxt, provider === p.provider && { color: '#fff', fontWeight: '600' }]}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Model select */}
            {preset.models.length > 0 && (
              <>
                <Text style={[styles.inputLabel, { marginTop: 8 }]}>模型</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {preset.models.map(m => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.modelPill, model === m && styles.modelPillActive]}
                      onPress={() => setModel(m)}
                    >
                      <Text style={[styles.modelTxt, model === m && { color: colors.purple }]}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* API Key */}
            <Text style={[styles.inputLabel, { marginTop: 8 }]}>API Key</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                value={apiKey} onChangeText={setApiKey}
                style={[styles.input, { flex: 1 }]}
                placeholder={preset.placeholder}
                placeholderTextColor={colors.text3}
                secureTextEntry={!showKey}
                autoCapitalize="none" autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowKey(s => !s)} style={styles.eyeBtn}>
                <Text style={{ fontSize: 18 }}>{showKey ? '🙈' : '👁'}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.skipHint}>没有 API Key？可以先跳过，之后在"我的"页面配置。</Text>

            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.btnGhost} onPress={() => setStep(1)}>
                <Text style={styles.btnGhostTxt}>← 返回</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnPrimary, { flex: 1 }]} onPress={finish}>
                <Text style={styles.btnPrimaryTxt}>开始使用 🎉</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={finish} style={{ alignItems: 'center', marginTop: 8 }}>
              <Text style={styles.skipTxt}>跳过，稍后配置</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: colors.bg },
  content:  { paddingHorizontal: spacing.xxl, paddingTop: 80, paddingBottom: 48, gap: 32, alignItems: 'stretch' },
  logoWrap: { alignItems: 'center', gap: 4 },
  logoEmoji:{ fontSize: 56 },
  logoTitle:{ fontSize: 36, fontWeight: '700', color: colors.text },
  logoSub:  { fontSize: 16, color: colors.text2 },
  steps:    { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  stepDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.bg5 },
  stepDotActive: { backgroundColor: colors.pink, width: 24 },
  stepDotDone:   { backgroundColor: colors.purple },
  card:     { backgroundColor: colors.bg3, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, gap: 16 },
  cardTitle:{ fontSize: 22, fontWeight: '700', color: colors.text },
  cardDesc: { fontSize: 14, color: colors.text2, lineHeight: 22 },
  features: { gap: 10 },
  featureItem:{ fontSize: 14, color: colors.text2, lineHeight: 20 },
  inputLabel:{ fontSize: 12, color: colors.text2, marginBottom: 6 },
  input:    { backgroundColor: colors.bg4, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border2, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14, color: colors.text },
  btnRow:   { flexDirection: 'row', gap: 10, marginTop: 4 },
  btnPrimary:{ backgroundColor: colors.pink, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
  btnPrimaryTxt:{ fontSize: 16, fontWeight: '600', color: '#fff' },
  btnGhost: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.border2, paddingVertical: 13, paddingHorizontal: 16, alignItems: 'center' },
  btnGhostTxt:{ fontSize: 15, color: colors.text2 },
  providerPill:{ borderRadius: radius.full, borderWidth: 1, borderColor: colors.border2, paddingHorizontal: 14, paddingVertical: 7 },
  providerPillActive:{ backgroundColor: colors.pink, borderColor: colors.pink },
  providerTxt:{ fontSize: 12, color: colors.text2 },
  modelPill:{ borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 5 },
  modelPillActive:{ borderColor: colors.purple, backgroundColor: 'rgba(155,127,232,0.12)' },
  modelTxt: { fontSize: 11, color: colors.text3 },
  eyeBtn:   { width: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg4, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border2 },
  skipHint: { fontSize: 12, color: colors.text3, lineHeight: 18 },
  skipTxt:  { fontSize: 13, color: colors.text3 },
})
