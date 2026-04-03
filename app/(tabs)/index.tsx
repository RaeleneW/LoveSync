// app/(tabs)/index.tsx
import React, { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, Image, Animated, FlatList } from 'react-native'
import { loadRecentRecords, type ConversationRecord } from '../../services/storage'
import { useFocusEffect, router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { spacing, radius } from '../../constants/theme'
import { useTheme } from '../../contexts/ThemeContext'
import { loadProfile, loadGamesState, computeWeeklyStats, levelProgress, type GamesState } from '../../services/storage'
import { loadLLMConfig } from '../../services/llm'
import { getDailyInspirationAI } from '../../services/inspiration'
import Svg, { Path, Line, Circle, Rect } from 'react-native-svg'

// 记录列表底部弹窗
function RecordsSheet({ type, onClose, onOpen }: {
  type: 'sweet' | 'conflict' | 'level' | null
  onClose: () => void
  onOpen: (id: string) => void
}) {
  const { theme } = useTheme()
  const [records, setRecords] = React.useState<ConversationRecord[]>([])
  const translateY = React.useRef(new Animated.Value(700)).current

  React.useEffect(() => {
    Animated.spring(translateY, { toValue: type ? 0 : 700, useNativeDriver: true, bounciness: 3 }).start()
    if (type && type !== 'level') {
      loadRecentRecords(50).then(all => {
        setRecords(type === 'sweet'
          ? all.filter(r => r.report.category === 'sweet')
          : all.filter(r => r.report.category === 'conflict'))
      })
    }
  }, [type])

  if (!type) return null

  const cfg = {
    sweet:    { emoji:'💕', title:'甜蜜时刻', color: theme.primary, empty:'还没有甜蜜时刻\n快去开始一次对话吧～' },
    conflict: { emoji:'🌶️', title:'需要沟通', color: theme.red, empty:'没有需要沟通的记录\n你们最近相处很融洽！' },
    level:    { emoji:'💝', title:'恋爱等级说明', color: theme.secondary, empty:'' },
  }[type]

  function fmtDate(ts: number) {
    const d = new Date(ts)
    return `${d.getMonth()+1}月${d.getDate()}日 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  }

  return (
    <Modal transparent animationType="none" visible={!!type} onRequestClose={onClose}>
      <TouchableOpacity style={rs.overlay} activeOpacity={1} onPress={onClose}/>
      <Animated.View style={[rs.sheet, { transform:[{translateY}], backgroundColor: theme.bg2 }]}>
        <View style={[rs.handle, { backgroundColor: theme.border }]}/>
        <View style={[rs.header, { borderBottomColor: theme.border }]}>
          <Text style={[rs.title, { color: theme.text }]}>{cfg.emoji} {cfg.title}</Text>
          <TouchableOpacity onPress={onClose}><Text style={[rs.close, { color: theme.primary }]}>关闭</Text></TouchableOpacity>
        </View>

        {type === 'level' ? (
          <ScrollView contentContainerStyle={rs.body}>
            <Text style={[rs.levelTitle, { color: theme.text2 }]}>经验值获取方式</Text>
            {[
              { icon:'mic', t:'完成对话分析',  xp:'+50 XP' },
              { icon:'edit', t:'文字描述分析',   xp:'+50 XP' },
              { icon:'game', t:'完成情侣游戏',   xp:'+10~100 XP' },
            ].map((row,i) => (
              <View key={i} style={[rs.levelRow, { backgroundColor: theme.bg3, borderColor: theme.border }]}>
                {row.icon === 'mic' && <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" stroke={theme.primary} strokeWidth={1.8}/><Path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke={theme.primary} strokeWidth={1.8}/><Line x1={12} y1={19} x2={12} y2={23} stroke={theme.primary} strokeWidth={1.8}/></Svg>}
                {row.icon === 'edit' && <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke={theme.primary} strokeWidth={1.8} strokeLinecap="round"/><Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke={theme.primary} strokeWidth={1.8} strokeLinecap="round"/></Svg>}
                {row.icon === 'game' && <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Rect x={2} y={3} width={20} height={14} rx={2} stroke={theme.primary} strokeWidth={1.8}/><Path d="M8 21h8M12 17v4" stroke={theme.primary} strokeWidth={1.8} strokeLinecap="round"/></Svg>}
                <Text style={[rs.levelRowTxt, { color: theme.text }]}>{row.t}</Text>
                <Text style={[rs.levelRowXP, { color: theme.primary }]}>{row.xp}</Text>
              </View>
            ))}
            <View style={[rs.levelNote, { backgroundColor: theme.secondaryDim, borderColor: theme.secondary + '4d' }]}>
              <Text style={[rs.levelNoteTxt, { color: theme.text2 }]}>等级代表你们一起探索彼此的深度，级别越高解锁更多游戏和功能。</Text>
            </View>
          </ScrollView>
        ) : (
          <FlatList
            data={records}
            keyExtractor={r => r.id}
            contentContainerStyle={rs.body}
            ListEmptyComponent={
              <View style={rs.empty}>
                {type==='sweet'
                  ? <Svg width={48} height={48} viewBox="0 0 24 24" fill="none"><Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke={theme.primary} strokeWidth={1.2} fill={theme.primaryDim}/></Svg>
                  : <Svg width={48} height={48} viewBox="0 0 24 24" fill="none"><Circle cx={12} cy={12} r={10} stroke={theme.red} strokeWidth={1.2}/><Path d="M12 8v4M12 16h.01" stroke={theme.red} strokeWidth={2} strokeLinecap="round"/></Svg>
                }
                <Text style={[rs.emptyTxt, { color: theme.text2 }]}>{cfg.empty}</Text>
              </View>
            }
            renderItem={({ item: r }) => (
              <TouchableOpacity style={[rs.recItem, { backgroundColor: theme.bg3, borderColor: theme.border }]} onPress={() => { onClose(); onOpen(r.id) }} activeOpacity={0.8}>
                <View style={rs.recLeft}>
                  <Text style={[rs.recTitle, { color: theme.text }]} numberOfLines={1}>{r.report.categoryLabel}</Text>
                  <Text style={[rs.recMeta, { color: theme.text3 }]}>{fmtDate(r.createdAt)}  ·  默契度 {r.report.harmonyScore}%</Text>
                  <Text style={[rs.recSummary, { color: theme.text2 }]} numberOfLines={2}>{r.report.aiSummary}</Text>
                </View>
                <Text style={[rs.recArrow, { color: theme.text3 }]}>›</Text>
              </TouchableOpacity>
            )}
          />
        )}
      </Animated.View>
    </Modal>
  )
}

const rs = StyleSheet.create({
  overlay: { position:'absolute',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(0,0,0,0.5)' },
  sheet: { position:'absolute',bottom:0,left:0,right:0,height:'75%',borderTopLeftRadius:24,borderTopRightRadius:24 },
  handle: { width:40,height:4,borderRadius:2,alignSelf:'center',marginTop:12,marginBottom:4 },
  header: { flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:24,paddingVertical:14,borderBottomWidth:1 },
  title: { fontSize:17,fontWeight:'600' },
  close: { fontSize:15 },
  body: { padding:20,gap:10,paddingBottom:40 },
  empty: { alignItems:'center',paddingVertical:60,gap:12 },
  emptyTxt: { fontSize:14,textAlign:'center',lineHeight:22 },
  recItem: { borderRadius:16,borderWidth:1,padding:16,flexDirection:'row',alignItems:'center',gap:12 },
  recLeft: { flex:1,gap:4 },
  recTitle: { fontSize:15,fontWeight:'500' },
  recMeta: { fontSize:11 },
  recSummary: { fontSize:12,lineHeight:18,marginTop:2 },
  recArrow: { fontSize:20 },
  levelTitle: { fontSize:14,marginBottom:8 },
  levelRow: { flexDirection:'row',alignItems:'center',gap:12,borderRadius:12,borderWidth:1,padding:14 },
  levelRowTxt: { flex:1,fontSize:14 },
  levelRowXP: { fontSize:13,fontWeight:'600' },
  levelNote: { borderRadius:12,borderWidth:1,padding:14,marginTop:8 },
  levelNoteTxt: { fontSize:13,lineHeight:20 },
})


function BreathingRings({ color }: { color: string }) {
  const anims = [0, 1, 2].map(() => React.useRef(new Animated.Value(0)).current)
  React.useEffect(() => {
    const makeLoop = (anim: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(anim, { toValue: 1, duration: 1800, useNativeDriver: true }),
        ]),
        Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]))
    const loops = anims.map((a, i) => makeLoop(a, i * 600))
    loops.forEach(l => l.start())
    return () => loops.forEach(l => l.stop())
  }, [])
  const sizes = [130, 110, 95]
  const baseColor = color.replace('#', '')
  const r = parseInt(baseColor.slice(0,2), 16)
  const g = parseInt(baseColor.slice(2,4), 16)
  const b = parseInt(baseColor.slice(4,6), 16)
  const colors = [`rgba(${r},${g},${b},0.12)`, `rgba(${r},${g},${b},0.2)`, `rgba(${r},${g},${b},0.28)`]
  return (
    <>
      {anims.map((anim, i) => (
        <Animated.View key={i} style={{
          position: 'absolute',
          width: sizes[i], height: sizes[i], borderRadius: sizes[i] / 2,
          backgroundColor: colors[i],
          opacity: anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 0] }),
          transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.3] }) }],
        }}/>
      ))}
    </>
  )
}

function LevelIcon({ size = 28, color = '#FF6B9D' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 21.593c-5.63-5.539-11-10.297-11-14.402C1 3.134 4.445 1 7.5 1c2.031 0 3.5 1 4.5 2 1-1 2.469-2 4.5-2C19.555 1 23 3.134 23 6.191c0 4.105-5.37 8.863-11 14.402z"
        stroke={color} strokeWidth={1.5} fill={color + '40'}
      />
      <Path
        d="M12 17c-3-2.5-6-5.5-6-8 0-1.657 1.343-3 3-3 .98 0 1.75.5 2.25 1.25L12 8l.75-1.75C13.25 5.5 14.02 5 15 5c1.657 0 3 1.343 3 3 0 2.5-3 5.5-6 8z"
        fill={color + '66'}
      />
    </Svg>
  )
}

function AnimatedBar({ pct, focusKey, color }: { pct: number; focusKey: number; color: string }) {
  const anim = React.useRef(new Animated.Value(0)).current
  React.useEffect(() => {
    anim.setValue(0)
    Animated.timing(anim, {
      toValue: pct,
      duration: 1000,
      delay: 200,
      useNativeDriver: false,
    }).start()
  }, [pct, focusKey])
  const width = anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] })
  return (
    <View style={{ backgroundColor:'rgba(255,255,255,0.08)', borderRadius:3, height:5, overflow:'hidden' }}>
      <Animated.View style={{ height:'100%', backgroundColor:color, borderRadius:3, width }} />
    </View>
  )
}

export default function HomeScreen() {
  const { theme } = useTheme()
  const [profile, setProfile]   = useState<{ nameA: string; nameB: string; avatarA?: string; avatarB?: string } | null>(null)
  const [games, setGames]       = useState<GamesState | null>(null)
  const [stats, setStats]       = useState({ sweetCount: 0, conflictCount: 0 })
  const [hasKey, setHasKey]     = useState(false)
  const [timeGreeting, setTimeGreeting] = useState('')
  const [sheetType, setSheetType] = useState<'sweet'|'conflict'|'level'|null>(null)
  const [inspiration, setInspiration] = useState('记得对微小的付出说谢谢。')
  const [focusKey, setFocusKey] = useState(0)


  useFocusEffect(React.useCallback(() => {
    setFocusKey(k => k + 1)
    let active = true
    ;(async () => {
      const [p, g, s, cfg] = await Promise.all([
        loadProfile(), loadGamesState(), computeWeeklyStats(), loadLLMConfig()
      ])
      if (!active) return
      if (!p) { router.replace('/onboarding'); return }
      setProfile(p)
      setGames(g)
      setStats({ sweetCount: s.sweetCount, conflictCount: s.conflictCount })
      setHasKey(!!cfg?.apiKey)
      const h = new Date().getHours()
      setTimeGreeting(h < 12 ? '早上好' : h < 18 ? '下午好' : '晚上好')
      // 异步加载 AI 灵感（不阻塞页面）
      getDailyInspirationAI().then(txt => { if (active) setInspiration(txt) }).catch(() => {})
    })()
    return () => { active = false }
  }, []))

  const progress = games ? levelProgress(games) : null

  function renderAvatar(avatar: string | undefined, fallback: string, borderColor: string) {
    if (avatar && avatar.startsWith('file://')) {
      return <Image source={{ uri: avatar }} style={[styles.avatarImg, { borderColor }]}/>
    }
    return (
      <View style={[styles.avatarEmoji, { borderColor }]}>
        <Text style={{ fontSize: 24 }}>{avatar || fallback}</Text>
      </View>
    )
  }

  return (
    <>
      <ScrollView style={[styles.screen, { backgroundColor: theme.bg }]} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <LinearGradient
            colors={['rgba(180,40,80,0.45)', 'rgba(155,127,232,0.15)', 'transparent']}
            style={StyleSheet.absoluteFill} start={{ x: 0.6, y: 0 }} end={{ x: 0, y: 1 }}
          />
          <View style={styles.blob1}/><View style={styles.blob2}/>

          <View style={styles.topRow}>
            <View style={[styles.liveBadge, { backgroundColor: theme.bg4 }]}>
              <View style={[styles.liveDot, { backgroundColor: theme.primary }]}/>
              <Text style={[styles.liveTxt, { color: theme.text2 }]}>LOVESYNC 连接中</Text>
            </View>
            {!hasKey && (
              <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} style={styles.noKeyBadge}>
                <Text style={[styles.noKeyTxt, { color: theme.amber }]}>⚠ 配置 API Key</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* 头像行 */}
          {profile && (
            <View style={styles.avatarRow}>
              {renderAvatar(profile.avatarA, '😊', theme.primary)}
              <View style={styles.greetingCenter}>
                <Text style={[styles.greetingTime, { color: theme.text2 }]}>{timeGreeting}</Text>
                <Text style={[styles.greetingNames, { color: theme.text }]}>{profile.nameA} & {profile.nameB}</Text>
              </View>
              {renderAvatar(profile.avatarB, '🥰', theme.secondary)}
            </View>
          )}

          {/* 灵感 */}
          <View style={[styles.inspoCard, { backgroundColor: theme.bg4, borderColor: theme.border }]}>
            <Text style={[styles.inspoLabel, { color: theme.primary }]}>✦ 今日爱情灵感</Text>
            <Text style={[styles.inspoText, { color: theme.text }]}>"{inspiration}"</Text>
          </View>
        </View>

        {/* 麦克风 */}
        <View style={[styles.micPanel, { backgroundColor: theme.bg3, borderColor: theme.border2 }]}>
          <View style={styles.micRingWrap}>
            <BreathingRings color={theme.primary} />
            <TouchableOpacity style={[styles.micRing, { backgroundColor: theme.bg4 }]} onPress={() => router.push('/(tabs)/record')} activeOpacity={0.8}>
              <Svg width={44} height={44} viewBox="0 0 24 24" fill="none">
                <Path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" stroke={theme.primary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
                <Path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke={theme.primary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
                <Line x1={12} y1={19} x2={12} y2={23} stroke={theme.primary} strokeWidth={1.8} strokeLinecap="round"/>
                <Line x1={8}  y1={23} x2={16} y2={23} stroke={theme.primary} strokeWidth={1.8} strokeLinecap="round"/>
              </Svg>
            </TouchableOpacity>
          </View>
          <Text style={[styles.micTitle, { color: theme.text }]}>点击开始分析</Text>
          <Text style={[styles.micSub, { color: theme.text2 }]}>AI 实时解读情感磁场</Text>
          <View style={styles.aiReady}>
            <View style={[styles.aiReadyDot, { backgroundColor: theme.green }]}/>
            <Text style={[styles.aiReadyTxt, { color: theme.green }]}>AI 模型就绪</Text>
          </View>
        </View>

        {/* 统计 */}
        <View style={styles.statsRow}>
          <TouchableOpacity style={[styles.statCard, { backgroundColor: theme.bg3, borderColor: theme.border }]} onPress={() => setSheetType('sweet')} activeOpacity={0.8}>
            <Text style={[styles.statNum, { color: theme.text }]}>{stats.sweetCount}</Text>
            <Text style={[styles.statLabel, { color: theme.text2 }]}>甜蜜时刻 ⓘ</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.statCard, { backgroundColor: theme.bg3, borderColor: theme.border }]} onPress={() => setSheetType('conflict')} activeOpacity={0.8}>
            <Text style={[styles.statNum, { color: theme.text }]}>{stats.conflictCount}</Text>
            <Text style={[styles.statLabel, { color: theme.text2 }]}>需要沟通 ⓘ</Text>
          </TouchableOpacity>
        </View>

        {/* 等级 */}
        {games && progress && (
          <TouchableOpacity style={[styles.levelCard, { backgroundColor: theme.bg3, borderColor: theme.border }]} onPress={() => setSheetType('level')} activeOpacity={0.85}>
            <View style={[styles.levelAvatar, { backgroundColor: theme.primaryDim }]}>
              <LevelIcon size={28} color={theme.primary} />
            </View>
            <View style={styles.levelInfo}>
              <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
                <Text style={[styles.levelTitle, { color: theme.text }]}>恋爱等级 <Text style={{ color:theme.primary }}>{games.level}</Text></Text>
                <Text style={{ fontSize:11, color:theme.text3 }}>ⓘ</Text>
              </View>
              <AnimatedBar pct={progress.pct} focusKey={focusKey} color={theme.primary} />
              <Text style={[styles.levelXP, { color: theme.primary }]}>{progress.current} / {progress.required} 经验值</Text>
            </View>
          </TouchableOpacity>
        )}
      </ScrollView>

      <RecordsSheet
        type={sheetType}
        onClose={() => setSheetType(null)}
        onOpen={(id) => router.push(`/report/${id}`)}
      />
    </>
  )
}



const styles = StyleSheet.create({
  screen: { flex:1 },
  content: { paddingBottom:32 },
  hero: { minHeight:280, paddingBottom:20, overflow:'hidden' },
  blob1: { position:'absolute', width:90, height:90, top:-20, right:30, borderRadius:45, backgroundColor:'rgba(220,60,100,0.25)' },
  blob2: { position:'absolute', width:55, height:55, top:60, right:10, borderRadius:27, backgroundColor:'rgba(220,60,100,0.18)' },
  topRow: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:spacing.xxl, paddingTop:64, marginBottom:16 },
  liveBadge: { flexDirection:'row', alignItems:'center', gap:6, borderRadius:radius.full, paddingHorizontal:12, paddingVertical:5 },
  liveDot: { width:7, height:7, borderRadius:3.5 },
  liveTxt: { fontSize:12 },
  noKeyBadge: { backgroundColor:'rgba(255,183,71,0.15)', borderRadius:radius.full, paddingHorizontal:10, paddingVertical:4, borderWidth:1, borderColor:'rgba(255,183,71,0.3)' },
  noKeyTxt: { fontSize:11 },
  avatarRow: { flexDirection:'row', alignItems:'center', paddingHorizontal:spacing.xxl, marginBottom:16 },
  avatarImg: { width:52, height:52, borderRadius:26, borderWidth:2 },
  avatarEmoji: { width:52, height:52, borderRadius:26, borderWidth:2, alignItems:'center', justifyContent:'center' },
  greetingCenter: { flex:1, alignItems:'center' },
  greetingTime: { fontSize:13, fontWeight:'300' },
  greetingNames: { fontSize:22, fontWeight:'700', marginTop:2 },
  inspoCard: { marginHorizontal:spacing.xxl, borderRadius:radius.lg, borderWidth:1, padding:16 },
  inspoLabel: { fontSize:11, marginBottom:8 },
  inspoText: { fontSize:14, fontWeight:'300', lineHeight:22 },
  micPanel: { marginHorizontal:spacing.xxl, marginTop:20, borderRadius:24, borderWidth:1, padding:32, alignItems:'center' },
  micRingWrap: { width:160, height:160, alignItems:'center', justifyContent:'center', alignSelf:'center' },
  micRing: { position:'absolute', width:90, height:90, borderRadius:45, borderWidth:1.5, alignItems:'center', justifyContent:'center' },
  micTitle: { fontSize:22, fontWeight:'600', marginBottom:6 },
  micSub: { fontSize:13, marginBottom:14 },
  aiReady: { flexDirection:'row', alignItems:'center', gap:6, borderRadius:radius.full, paddingHorizontal:12, paddingVertical:5, borderWidth:1, borderColor:'rgba(76,175,125,0.3)', backgroundColor:'rgba(76,175,125,0.12)' },
  aiReadyDot: { width:6, height:6, borderRadius:3 },
  aiReadyTxt: { fontSize:11 },
  statsRow: { flexDirection:'row', gap:12, marginHorizontal:spacing.xxl, marginTop:16 },
  statCard: { flex:1, borderRadius:radius.lg, borderWidth:1, padding:spacing.lg, alignItems:'center' },
  statNum: { fontSize:28, fontWeight:'700' },
  statLabel: { fontSize:11, marginTop:3 },
  levelCard: { marginHorizontal:spacing.xxl, marginTop:16, borderRadius:radius.lg, borderWidth:1, padding:spacing.lg, flexDirection:'row', alignItems:'center', gap:14 },
  levelAvatar: { width:48, height:48, borderRadius:24, alignItems:'center', justifyContent:'center', flexShrink:0, overflow:'hidden' },
  levelAvatarImg: { width:48, height:48, borderRadius:24 },
  levelInfo: { flex:1 },
  levelTitle: { fontSize:14, fontWeight:'500', marginBottom:6 },
  barWrap: { borderRadius:3, height:5, overflow:'hidden' },
  bar: { height:'100%', borderRadius:3 },
  levelXP: { fontSize:11, marginTop:5 },
})
