// app/(tabs)/profile.tsx — 弹出式抽屉
import React, { useState, useRef } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert,
  Modal, Animated, TextInput, ActivityIndicator, Dimensions, Image,
} from 'react-native'
import { useFocusEffect, router } from 'expo-router'
import Svg, { Path, Circle, Line, Rect, Polyline } from 'react-native-svg'
import * as ImagePicker from 'expo-image-picker'
import { spacing, radius } from '../../constants/theme'
import { useTheme } from '../../contexts/ThemeContext'
import { themes } from '../../constants/themes'
import { loadProfile, saveProfile, loadGamesState, levelProgress, clearAllData } from '../../services/storage'
import { loadLLMConfig, saveLLMConfig, testAPIKey, PRESET_MODELS, type LLMConfig, type ModelProvider } from '../../services/llm'
import { loadSTTConfig, saveSTTConfig, testSTTKey, STT_PRESETS, type STTConfig } from '../../services/audio'

const { height: SCREEN_H } = Dimensions.get('window')
const DRAWER_H = SCREEN_H * 0.75

// ── 通用底部抽屉 ───────────────────────────────────────────────
function Drawer({ visible, onClose, title, children, theme }: {
  visible: boolean; onClose: () => void; title: string; children: React.ReactNode; theme: any
}) {
  const translateY = useRef(new Animated.Value(DRAWER_H)).current

  React.useEffect(() => {
    Animated.spring(translateY, {
      toValue: visible ? 0 : DRAWER_H,
      useNativeDriver: true,
      bounciness: 4,
    }).start()
  }, [visible])

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onClose}>
      <TouchableOpacity style={d.overlay} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[d.drawer, { transform: [{ translateY }], backgroundColor: theme.bg2 }]}>
        <View style={[d.handle, { backgroundColor: theme.border }]} />
        <View style={[d.drawerHeader, { borderBottomColor: theme.border }]}>
          <Text style={[d.drawerTitle, { color: theme.text }]}>{title}</Text>
          <TouchableOpacity onPress={onClose}><Text style={[d.drawerClose, { color: theme.primary }]}>完成</Text></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={d.drawerContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      </Animated.View>
    </Modal>
  )
}

// ── 昵称抽屉内容 ──────────────────────────────────────────────
function AvatarPicker({ value, onChange, label, theme }: {
  value: string; onChange: (v: string) => void; label: string; theme: any
}) {
  async function pick() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('需要相册权限', '请在系统设置中允许 LoveSync 访问相册')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    })
    if (!result.canceled && result.assets[0]?.uri) {
      onChange(result.assets[0].uri)
    }
  }

  async function camera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('需要相机权限', '请在系统设置中允许 LoveSync 访问相机')
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    })
    if (!result.canceled && result.assets[0]?.uri) {
      onChange(result.assets[0].uri)
    }
  }

  function showOptions() {
    Alert.alert(`设置${label}头像`, '', [
      { text: '从相册选择', onPress: pick },
      { text: '拍照', onPress: camera },
      ...(value ? [{ text: '删除头像', style: 'destructive' as const, onPress: () => onChange('') }] : []),
      { text: '取消', style: 'cancel' },
    ])
  }

  return (
    <TouchableOpacity onPress={showOptions} style={av.wrap} activeOpacity={0.8}>
      {value ? (
        <Image source={{ uri: value }} style={[av.img, { borderColor: theme.primary }]}/>
      ) : (
        <View style={[av.placeholder, { backgroundColor: theme.bg3, borderColor: theme.border }]}>
          <Text style={[av.placeholderTxt, { color: theme.text3 }]}>+</Text>
          <Text style={[av.placeholderSub, { color: theme.text3 }]}>点击上传</Text>
        </View>
      )}
      <View style={[av.editBadge, { backgroundColor: theme.primary }]}><Text style={av.editTxt}>✏️</Text></View>
    </TouchableOpacity>
  )
}

const av = StyleSheet.create({
  wrap: { width:80, height:80, borderRadius:40, marginTop:4, position:'relative', alignSelf:'flex-start' },
  img: { width:80, height:80, borderRadius:40, borderWidth:2 },
  placeholder: { width:80, height:80, borderRadius:40, borderWidth:2, borderStyle:'dashed', alignItems:'center', justifyContent:'center', gap:2 },
  placeholderTxt: { fontSize:24 },
  placeholderSub: { fontSize:10 },
  editBadge: { position:'absolute', bottom:0, right:0, width:24, height:24, borderRadius:12, alignItems:'center', justifyContent:'center' },
  editTxt: { fontSize:11 },
})

function NamesDrawer({ onClose, theme }: { onClose: () => void; theme: any }) {
  const [nameA, setNameA] = useState('')
  const [nameB, setNameB] = useState('')
  const [avatarA, setAvatarA] = useState('😊')
  const [avatarB, setAvatarB] = useState('🥰')
  const [saving, setSaving] = useState(false)
  React.useEffect(() => {
    loadProfile().then(p => {
      if (p) {
        setNameA(p.nameA); setNameB(p.nameB)
        if (p.avatarA) setAvatarA(p.avatarA)
        if (p.avatarB) setAvatarB(p.avatarB)
      }
    })
  }, [])
  async function save() {
    if (!nameA.trim() || !nameB.trim()) { Alert.alert('请填写两人昵称'); return }
    setSaving(true)
    await saveProfile({ nameA: nameA.trim(), nameB: nameB.trim(), avatarA, avatarB, createdAt: Date.now() })
    setSaving(false)
    onClose()
  }
  return (
    <View style={{gap:16}}>
      <View style={d.field}>
        <Text style={[d.label, { color: theme.text2 }]}>你的昵称</Text>
        <TextInput value={nameA} onChangeText={setNameA} style={[d.input, { backgroundColor: theme.bg3, borderColor: theme.border, color: theme.text }]} placeholder="例：小刘" placeholderTextColor={theme.text3}/>
        <Text style={[d.label, { color: theme.text2, marginTop:8 }]}>你的头像</Text>
        <AvatarPicker value={avatarA} onChange={setAvatarA} label={nameA || '你'} theme={theme}/>
      </View>
      <View style={d.field}>
        <Text style={[d.label, { color: theme.text2 }]}>TA 的昵称</Text>
        <TextInput value={nameB} onChangeText={setNameB} style={[d.input, { backgroundColor: theme.bg3, borderColor: theme.border, color: theme.text }]} placeholder="例：小曹" placeholderTextColor={theme.text3}/>
        <Text style={[d.label, { color: theme.text2, marginTop:8 }]}>TA 的头像</Text>
        <AvatarPicker value={avatarB} onChange={setAvatarB} label={nameB || 'TA'} theme={theme}/>
      </View>
      <TouchableOpacity onPress={save} disabled={saving} style={[d.saveBtn, { backgroundColor: theme.primary }]}>
        {saving ? <ActivityIndicator color="#fff"/> : <Text style={d.saveBtnTxt}>保存</Text>}
      </TouchableOpacity>
    </View>
  )
}

// ── STT 抽屉内容 ──────────────────────────────────────────────
function STTDrawer({ onClose, theme }: { onClose: () => void; theme: any }) {
  const [sttCfg, setSttCfg] = useState<STTConfig | null>(null)
  const [sttKey, setSttKey] = useState('')
  const [sttModel, setSttModel] = useState('')
  const [sttCustomURL, setSttCustomURL] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'ok'|'fail'|null>(null)
  React.useEffect(() => {
    loadSTTConfig().then(s => {
      const def: STTConfig = { provider: 'siliconflow', apiKey: '', model: 'FunAudioLLM/SenseVoiceSmall' }
      const cfg = s ?? def
      setSttCfg(cfg); setSttKey(cfg.apiKey); setSttModel(cfg.model)
      if (cfg.provider === 'custom') setSttCustomURL(cfg.baseURL ?? '')
    })
  }, [])
  function selectProvider(p: STTConfig['provider']) {
    const preset = STT_PRESETS.find(x => x.provider === p)
    setSttCfg(prev => ({ ...prev!, provider: p }))
    setSttModel(preset?.defaultModel ?? '')
    setTestResult(null)
  }
  async function handleTest() {
    if (!sttKey.trim()) { Alert.alert('请先输入 API Key'); return }
    setTesting(true); setTestResult(null)
    const preset = STT_PRESETS.find(x => x.provider === sttCfg?.provider)
    const cfg: STTConfig = {
      provider: sttCfg?.provider ?? 'siliconflow', apiKey: sttKey.trim(),
      model: sttModel.trim() || preset?.defaultModel || 'whisper-1',
      baseURL: sttCfg?.provider === 'custom' ? sttCustomURL : preset?.baseURL,
    }
    const { ok, error } = await testSTTKey(cfg)
    setTestResult(ok ? 'ok' : 'fail')
    setTesting(false)
    if (ok) { await saveSTTConfig(cfg); Alert.alert('✓ 验证通过并已保存'); onClose() }
    else Alert.alert('验证失败', error ?? '请检查 Key')
  }
  const preset = STT_PRESETS.find(x => x.provider === sttCfg?.provider)
  return (
    <View style={{gap:14}}>
      <Text style={[d.desc, { color: theme.text2 }]}>DeepSeek 不支持语音，需单独配置 STT 服务</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}>
        {STT_PRESETS.map(p => (
          <TouchableOpacity key={p.provider} style={[d.pill, { backgroundColor: theme.bg3, borderColor: theme.border }, sttCfg?.provider===p.provider && { backgroundColor: theme.primary, borderColor: theme.primary }]} onPress={() => selectProvider(p.provider)}>
            <Text style={[d.pillTxt, { color: theme.text2 }, sttCfg?.provider===p.provider && d.pillTxtOn]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {preset && <Text style={[d.desc, { color: theme.text3 }]}>{preset.desc}</Text>}
      {sttCfg?.provider === 'custom' && (
        <View style={d.field}>
          <Text style={[d.label, { color: theme.text2 }]}>Base URL</Text>
          <TextInput value={sttCustomURL} onChangeText={setSttCustomURL} style={[d.input, { backgroundColor: theme.bg3, borderColor: theme.border, color: theme.text }]} placeholder="https://..." placeholderTextColor={theme.text3} autoCapitalize="none"/>
        </View>
      )}
      <View style={d.field}>
        <Text style={[d.label, { color: theme.text2 }]}>模型名称</Text>
        <TextInput value={sttModel} onChangeText={v=>{setSttModel(v);setTestResult(null)}} style={[d.input, { backgroundColor: theme.bg3, borderColor: theme.border, color: theme.text }]} placeholder={preset?.defaultModel} placeholderTextColor={theme.text3} autoCapitalize="none" autoCorrect={false}/>
        <Text style={[d.hint, { color: theme.text3 }]}>留空则使用默认模型</Text>
      </View>
      <View style={d.field}>
        <Text style={[d.label, { color: theme.text2 }]}>API Key</Text>
        <View style={{flexDirection:'row',gap:8}}>
          <TextInput value={sttKey} onChangeText={v=>{setSttKey(v);setTestResult(null)}} style={[d.input, { backgroundColor: theme.bg3, borderColor: theme.border, color: theme.text, flex:1 }]} placeholder={preset?.placeholder} placeholderTextColor={theme.text3} secureTextEntry={!showKey} autoCapitalize="none" autoCorrect={false}/>
          <TouchableOpacity onPress={()=>setShowKey(v=>!v)} style={[d.eyeBtn, { backgroundColor: theme.bg3, borderColor: theme.border }]}><Text style={{fontSize:18}}>{showKey?'🙈':'👁'}</Text></TouchableOpacity>
        </View>
      </View>
      {sttCfg?.provider === 'siliconflow' && (
        <View style={[d.tipCard, { backgroundColor: theme.bg3, borderColor: theme.border }]}>
          <Text style={[d.tipTitle, { color: theme.text }]}>如何获取 SiliconFlow Key</Text>
          <Text style={[d.tipTxt, { color: theme.text2 }]}>1. 访问 siliconflow.cn 注册{'\n'}2. 控制台 → API 密钥 → 新建{'\n'}3. 复制 sk-... 粘贴到上方</Text>
        </View>
      )}
      <TouchableOpacity onPress={handleTest} disabled={testing} style={[d.saveBtn, { backgroundColor: theme.primary }]}>
        {testing ? <ActivityIndicator color="#fff" size="small"/>
          : <Text style={d.saveBtnTxt}>{testResult==='ok'?'✓ 已保存':testResult==='fail'?'✕ 验证失败':'验证并保存'}</Text>}
      </TouchableOpacity>
    </View>
  )
}

// ── LLM 抽屉内容 ──────────────────────────────────────────────
function LLMDrawer({ onClose, theme }: { onClose: () => void; theme: any }) {
  const [cfg, setCfg] = useState<LLMConfig | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [customModel, setCustomModel] = useState('')
  const [customURL, setCustomURL] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'ok'|'fail'|null>(null)
  React.useEffect(() => {
    loadLLMConfig().then(c => {
      if (c) { setCfg(c); setApiKey(c.apiKey); if (c.provider==='custom'){setCustomModel(c.model);setCustomURL(c.baseURL??'')} }
      else setCfg({ provider:'openai', apiKey:'', model:'gpt-4o-mini' })
    })
  }, [])
  function selectProvider(provider: ModelProvider) {
    const preset = PRESET_MODELS.find(p => p.provider === provider)!
    setCfg(prev => ({ ...(prev??{apiKey}), provider, model: preset.models[0]??'', baseURL: preset.baseURL }))
    setTestResult(null)
  }
  async function handleTest() {
    if (!cfg || !apiKey.trim()) { Alert.alert('请先输入 API Key'); return }
    setTesting(true); setTestResult(null)
    const finalCfg: LLMConfig = { ...cfg, apiKey: apiKey.trim(), ...(cfg.provider==='custom'?{model:customModel,baseURL:customURL}:{}) }
    const { ok, error } = await testAPIKey(finalCfg)
    setTestResult(ok ? 'ok' : 'fail')
    setTesting(false)
    if (ok) { await saveLLMConfig(finalCfg); Alert.alert('✓ 验证通过并已保存'); onClose() }
    else Alert.alert('验证失败', error ?? '请检查 API Key')
  }
  const preset = PRESET_MODELS.find(p => p.provider === cfg?.provider)
  return (
    <View style={{gap:14}}>
      <Text style={[d.desc, { color: theme.text2 }]}>用于分析对话内容，生成情感报告</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}>
        {PRESET_MODELS.map(p => (
          <TouchableOpacity key={p.provider} style={[d.pill, { backgroundColor: theme.bg3, borderColor: theme.border }, cfg?.provider===p.provider && { backgroundColor: theme.primary, borderColor: theme.primary }]} onPress={() => selectProvider(p.provider)}>
            <Text style={[d.pillTxt, { color: theme.text2 }, cfg?.provider===p.provider && d.pillTxtOn]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {preset && preset.models.length > 0 && (
        <View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>
          {preset.models.map(m => (
            <TouchableOpacity key={m} style={[d.modelPill, { backgroundColor: theme.bg3, borderColor: theme.border }, cfg?.model===m && { backgroundColor: theme.primaryDim, borderColor: theme.primary }]} onPress={() => setCfg(prev => prev?{...prev,model:m}:null)}>
              <Text style={[d.modelTxt, { color: theme.text2 }, cfg?.model===m && { color: theme.text }]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {cfg?.provider === 'custom' && (
        <>
          <View style={d.field}>
            <Text style={[d.label, { color: theme.text2 }]}>Base URL</Text>
            <TextInput value={customURL} onChangeText={setCustomURL} style={[d.input, { backgroundColor: theme.bg3, borderColor: theme.border, color: theme.text }]} placeholder="https://..." placeholderTextColor={theme.text3} autoCapitalize="none"/>
          </View>
          <View style={d.field}>
            <Text style={[d.label, { color: theme.text2 }]}>模型名称</Text>
            <TextInput value={customModel} onChangeText={setCustomModel} style={[d.input, { backgroundColor: theme.bg3, borderColor: theme.border, color: theme.text }]} placeholder="gpt-4o" placeholderTextColor={theme.text3} autoCapitalize="none"/>
          </View>
        </>
      )}
      <View style={d.field}>
        <Text style={[d.label, { color: theme.text2 }]}>API Key</Text>
        <View style={{flexDirection:'row',gap:8}}>
          <TextInput value={apiKey} onChangeText={v=>{setApiKey(v);setTestResult(null)}} style={[d.input, { backgroundColor: theme.bg3, borderColor: theme.border, color: theme.text, flex:1 }]} placeholder={preset?.placeholder??'API Key'} placeholderTextColor={theme.text3} secureTextEntry={!showKey} autoCapitalize="none" autoCorrect={false}/>
          <TouchableOpacity onPress={()=>setShowKey(v=>!v)} style={[d.eyeBtn, { backgroundColor: theme.bg3, borderColor: theme.border }]}><Text style={{fontSize:18}}>{showKey?'🙈':'👁'}</Text></TouchableOpacity>
        </View>
      </View>
      <TouchableOpacity onPress={handleTest} disabled={testing} style={[d.saveBtn, { backgroundColor: theme.primary }]}>
        {testing ? <ActivityIndicator color="#fff" size="small"/>
          : <Text style={d.saveBtnTxt}>{testResult==='ok'?'✓ 已保存':testResult==='fail'?'✕ 验证失败':'验证并保存'}</Text>}
      </TouchableOpacity>
    </View>
  )
}

// ── 主页面 ─────────────────────────────────────────────────────
type DrawerType = 'names' | 'stt' | 'llm' | null

function LevelIcon({ size = 22, theme }: { size?: number; theme: any }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402C1 3.134 4.445 1 7.5 1c2.031 0 3.5 1 4.5 2 1-1 2.469-2 4.5-2C19.555 1 23 3.134 23 6.191c0 4.105-5.37 8.863-11 14.402z" stroke={theme.primary} strokeWidth={1.5} fill={theme.primaryDim}/>
      <Path d="M12 17c-3-2.5-6-5.5-6-8 0-1.657 1.343-3 3-3 .98 0 1.75.5 2.25 1.25L12 8l.75-1.75C13.25 5.5 14.02 5 15 5c1.657 0 3 1.343 3 3 0 2.5-3 5.5-6 8z" fill={theme.primary + '66'}/>
    </Svg>
  )
}

function AnimatedBar({ pct, theme }: { pct: number; theme: any }) {
  const anim = React.useRef(new Animated.Value(0)).current
  React.useEffect(() => {
    anim.setValue(0)
    Animated.timing(anim, { toValue: pct, duration: 1000, delay: 200, useNativeDriver: false }).start()
  }, [pct])
  const width = anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] })
  return (
    <View style={{ backgroundColor:'rgba(255,255,255,0.08)', borderRadius:3, height:5, overflow:'hidden' }}>
      <Animated.View style={{ height:'100%', backgroundColor:theme.primary, borderRadius:3, width }} />
    </View>
  )
}

export default function ProfileScreen() {
  const { theme, themeName } = useTheme()
  const [nameA, setNameA] = useState('')
  const [nameB, setNameB] = useState('')
  const [llmInfo, setLlmInfo] = useState('')
  const [sttInfo, setSttInfo] = useState('')
  const [games, setGames] = useState<any>(null)
  const [activeDrawer, setActiveDrawer] = useState<DrawerType>(null)

  const refresh = React.useCallback(async () => {
    const [p, c, s, g] = await Promise.all([loadProfile(), loadLLMConfig(), loadSTTConfig(), loadGamesState()])
    setNameA(p?.nameA ?? ''); setNameB(p?.nameB ?? '')
    setLlmInfo(c ? `${c.provider} · ${c.model}` : '未配置')
    setSttInfo(s ? `${s.provider} · ${s.model}` : '未配置')
    setGames(g)
  }, [])

  useFocusEffect(React.useCallback(() => { refresh() }, []))

  function closeDrawer() { setActiveDrawer(null); refresh() }
  const progress = games ? levelProgress(games) : null
  const themeLabel = themes[themeName].themeLabel

  return (
    <>
      <ScrollView style={[s.screen, { backgroundColor: theme.bg }]} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={[s.title, { color: theme.text }]}>我的</Text>

        {games && progress && (
          <View style={[s.levelCard, { backgroundColor: theme.bg3, borderColor: theme.border }]}>
            <View style={[s.levelAvatar, { backgroundColor: theme.primaryDim }]}><LevelIcon size={28} theme={theme}/></View>
            <View style={{flex:1}}>
              <Text style={[s.levelTitle, { color: theme.text }]}>恋爱等级 <Text style={{color:theme.primary,fontSize:22}}>{games.level}</Text></Text>
              <AnimatedBar pct={progress.pct} theme={theme} />
              <Text style={[s.levelXP, { color: theme.primary }]}>{progress.current} / {progress.required} 经验值</Text>
            </View>
          </View>
        )}

        <Text style={[s.groupLabel, { color: theme.text3 }]}>基本设置</Text>
        <View style={[s.group, { backgroundColor: theme.bg3, borderColor: theme.border }]}>
          <Row iconEl={<Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke={theme.primary} strokeWidth={1.8} strokeLinecap="round"/><Circle cx={9} cy={7} r={4} stroke={theme.primary} strokeWidth={1.8}/><Path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke={theme.primary} strokeWidth={1.8} strokeLinecap="round"/></Svg>} title="伴侣昵称" value={nameA && nameB ? `${nameA} & ${nameB}` : '未设置'} onPress={() => setActiveDrawer('names')}/>
          <View style={[s.divider, { backgroundColor: theme.border }]}/>
          <Row iconEl={<Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Circle cx={12} cy={12} r={10} stroke={theme.primary} strokeWidth={1.8}/><Path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" stroke={theme.primary} strokeWidth={1.8} strokeLinecap="round"/></Svg>} title="AI 对话模型" value={llmInfo} onPress={() => setActiveDrawer('llm')}/>
          <View style={[s.divider, { backgroundColor: theme.border }]}/>
          <Row iconEl={<Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" stroke={theme.primary} strokeWidth={1.8}/><Path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke={theme.primary} strokeWidth={1.8}/><Line x1={12} y1={19} x2={12} y2={23} stroke={theme.primary} strokeWidth={1.8} strokeLinecap="round"/></Svg>} title="语音转文字" value={sttInfo} onPress={() => setActiveDrawer('stt')}/>
          <View style={[s.divider, { backgroundColor: theme.border }]}/>
          <Row iconEl={<Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Circle cx={12} cy={12} r={5} stroke={theme.primary} strokeWidth={1.8}/><Line x1={12} y1={1} x2={12} y2={3} stroke={theme.primary} strokeWidth={1.8}/><Line x1={12} y1={21} x2={12} y2={23} stroke={theme.primary} strokeWidth={1.8}/><Line x1={4.22} y1={4.22} x2={5.64} y2={5.64} stroke={theme.primary} strokeWidth={1.8}/><Line x1={18.36} y1={18.36} x2={19.78} y2={19.78} stroke={theme.primary} strokeWidth={1.8}/><Line x1={1} y1={12} x2={3} y2={12} stroke={theme.primary} strokeWidth={1.8}/><Line x1={21} y1={12} x2={23} y2={12} stroke={theme.primary} strokeWidth={1.8}/><Line x1={4.22} y1={19.78} x2={5.64} y2={18.36} stroke={theme.primary} strokeWidth={1.8}/><Line x1={18.36} y1={5.64} x2={19.78} y2={4.22} stroke={theme.primary} strokeWidth={1.8}/></Svg>} title="主题设置" value={themeLabel} onPress={() => router.push('/theme' as any)}/>
        </View>

        <Text style={[s.groupLabel, { color: theme.text3 }]}>隐私</Text>
        <View style={[s.group, { backgroundColor: theme.bg3, borderColor: theme.border }]}>
          <View style={{paddingHorizontal:spacing.lg,paddingVertical:14}}>
            <Text style={{fontSize:13,color:theme.text2,lineHeight:22}}>• 所有 Key 仅存储在本机{'\n'}• 录音、报告全部离线存储{'\n'}• 无账号，无数据收集</Text>
          </View>
          <View style={[s.divider, { backgroundColor: theme.border }]}/>
          <TouchableOpacity style={s.row} onPress={() =>
            Alert.alert('清除所有记录','将删除全部对话记录和游戏数据',[
              {text:'取消',style:'cancel'},
              {text:'清除',style:'destructive',onPress:async()=>{await clearAllData();Alert.alert('已清除')}}
            ])}>
            <View style={s.rowLeft}>
              <View style={[s.rowIcon,{backgroundColor:'rgba(255,82,82,0.12)'}]}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Polyline points="3 6 5 6 21 6" stroke={theme.red} strokeWidth={1.8} strokeLinecap="round"/>
                  <Path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke={theme.red} strokeWidth={1.8} strokeLinecap="round"/>
                  <Path d="M10 11v6M14 11v6" stroke={theme.red} strokeWidth={1.8} strokeLinecap="round"/>
                </Svg>
              </View>
              <Text style={[s.rowTitle,{color:theme.red}]}>清除所有记录</Text>
            </View>
            <Text style={[s.rowArrow, { color: theme.text3 }]}>›</Text>
          </TouchableOpacity>
        </View>

        <Text style={{fontSize:11,color:theme.text3,textAlign:'center',marginTop:8}}>LoveSync v1.0.0 · 纯本地 · 零服务器</Text>
      </ScrollView>

      <Drawer visible={activeDrawer==='names'} onClose={closeDrawer} title="伴侣昵称" theme={theme}>
        <NamesDrawer onClose={closeDrawer} theme={theme}/>
      </Drawer>
      <Drawer visible={activeDrawer==='stt'} onClose={closeDrawer} title="语音转文字（STT）" theme={theme}>
        <STTDrawer onClose={closeDrawer} theme={theme}/>
      </Drawer>
      <Drawer visible={activeDrawer==='llm'} onClose={closeDrawer} title="AI 对话模型" theme={theme}>
        <LLMDrawer onClose={closeDrawer} theme={theme}/>
      </Drawer>
    </>
  )
}

function Row({ iconEl, title, value, onPress }: { iconEl:React.ReactNode; title:string; value?:string; onPress:()=>void }) {
  const { theme } = useTheme()
  return (
    <TouchableOpacity onPress={onPress} style={s.row} activeOpacity={0.7}>
      <View style={s.rowLeft}>
        <View style={[s.rowIcon, { backgroundColor: theme.bg5 }]}>{iconEl}</View>
        <View style={{flex:1}}>
          <Text style={[s.rowTitle, { color: theme.text }]}>{title}</Text>
          {value ? <Text style={[s.rowValue, { color: theme.text3 }]} numberOfLines={1}>{value}</Text> : null}
        </View>
      </View>
      <Text style={[s.rowArrow, { color: theme.text3 }]}>›</Text>
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  screen: {flex:1},
  content: {paddingHorizontal:spacing.xxl,paddingTop:64,paddingBottom:48,gap:8},
  title: {fontSize:26,fontWeight:'700',marginBottom:8},
  levelCard: {borderRadius:radius.lg,borderWidth:1,padding:spacing.lg,flexDirection:'row',alignItems:'center',gap:14,marginBottom:8},
  levelAvatar: {width:56,height:56,borderRadius:28,alignItems:'center',justifyContent:'center'},
  levelTitle: {fontSize:14,fontWeight:'500',marginBottom:8},
  tagline: { fontSize:11, color:'rgba(255,255,255,0.2)', textAlign:'center', lineHeight:18, paddingVertical:24, paddingHorizontal:24 },
  barWrap: {backgroundColor:'rgba(255,255,255,0.08)',borderRadius:3,height:5,overflow:'hidden'},
  bar: {height:'100%',borderRadius:3},
  levelXP: {fontSize:11,marginTop:5},
  groupLabel: {fontSize:13,marginLeft:4,marginTop:8,marginBottom:4},
  group: {borderRadius:radius.xl,borderWidth:1,overflow:'hidden'},
  divider: {height:1,marginLeft:56},
  row: {flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:spacing.lg,paddingVertical:14},
  rowLeft: {flexDirection:'row',alignItems:'center',gap:12,flex:1},
  rowIcon: {width:32,height:32,borderRadius:8,alignItems:'center',justifyContent:'center'},
  rowTitle: {fontSize:15},
  rowValue: {fontSize:12,marginTop:2,maxWidth:200},
  rowArrow: {fontSize:22},
})

const d = StyleSheet.create({
  overlay: {position:'absolute',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(0,0,0,0.5)'},
  drawer: {position:'absolute',bottom:0,left:0,right:0,height:DRAWER_H,borderTopLeftRadius:24,borderTopRightRadius:24,overflow:'hidden'},
  handle: {width:40,height:4,borderRadius:2,alignSelf:'center',marginTop:12,marginBottom:4},
  drawerHeader: {flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:spacing.xxl,paddingVertical:14,borderBottomWidth:1},
  drawerTitle: {fontSize:17,fontWeight:'600'},
  drawerClose: {fontSize:16,fontWeight:'500'},
  drawerContent: {paddingHorizontal:spacing.xxl,paddingVertical:spacing.xl,paddingBottom:40},
  field: {gap:8},
  label: {fontSize:13},
  hint: {fontSize:10},
  input: {borderRadius:radius.sm,borderWidth:1,paddingHorizontal:14,paddingVertical:13,fontSize:15},
  eyeBtn: {width:46,alignItems:'center',justifyContent:'center',borderRadius:radius.sm,borderWidth:1},
  pill: {borderRadius:radius.full,borderWidth:1,paddingHorizontal:12,paddingVertical:6},
  pillTxt: {fontSize:11},
  pillTxtOn: {color:'#fff',fontWeight:'600'},
  modelPill: {borderRadius:radius.sm,borderWidth:1,paddingHorizontal:10,paddingVertical:5},
  modelTxt: {fontSize:11},
  desc: {fontSize:13},
  saveBtn: {borderRadius:radius.md,paddingVertical:14,alignItems:'center'},
  saveBtnTxt: {fontSize:16,fontWeight:'600',color:'#fff'},
  tipCard: {borderRadius:radius.sm,borderWidth:1,padding:12},
  tipTitle: {fontSize:12,fontWeight:'600',marginBottom:6},
  tipTxt: {fontSize:12,lineHeight:20},
})
