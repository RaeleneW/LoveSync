// app/(tabs)/games.tsx
import React, { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Modal, Animated, ActivityIndicator } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { spacing, radius } from '../../constants/theme'
import { useTheme } from '../../contexts/ThemeContext'
import Svg, { Path, Circle, Rect, Line, Polyline } from 'react-native-svg'
import { loadGamesState, levelProgress, addXP, loadCheckins, saveCheckin, generateId, type GamesState, type CheckinRecord } from '../../services/storage'
import { loadProfile } from '../../services/storage'

// ── 题库（关于对方的题目，A答关于B，B答关于A）──────────────────
const QUESTION_POOL = [
  { q: 'TA 最喜欢的零食口味？', opts: ['甜', '咸', '辣', '酸'] },
  { q: 'TA 睡前最常做的事？', opts: ['刷手机', '看书', '听音乐', '发呆'] },
  { q: 'TA 最怕什么？', opts: ['虫子', '黑暗', '孤独', '尴尬'] },
  { q: 'TA 理想的周末是？', opts: ['宅家', '出游', '购物', '运动'] },
  { q: 'TA 生气时会怎样？', opts: ['冷战', '直说', '哭', '发脾气'] },
  { q: 'TA 最爱点哪类外卖？', opts: ['中餐', '日料', '西餐', '奶茶甜品'] },
  { q: 'TA 起床第一件事？', opts: ['刷手机', '洗漱', '喝水', '继续睡'] },
  { q: 'TA 购物时什么最重要？', opts: ['颜值', '实用', '性价比', '品牌'] },
  { q: 'TA 最喜欢的季节？', opts: ['春', '夏', '秋', '冬'] },
  { q: 'TA 压力大时会？', opts: ['找人倾诉', '独处安静', '吃东西', '睡觉'] },
  { q: 'TA 旅行首选目的地类型？', opts: ['海滩', '山野', '城市', '古镇'] },
  { q: 'TA 最常用哪个 APP？', opts: ['微信', '抖音', '微博', '小红书'] },
  { q: 'TA 对迟到的态度？', opts: ['超级介意', '有点介意', '无所谓', '自己也常迟到'] },
  { q: 'TA 更喜欢哪种约会？', opts: ['在家煮饭', '出去吃饭', '看电影', '逛街'] },
  { q: 'TA 睡觉时偏好？', opts: ['开灯', '关灯', '要白噪音', '要绝对安静'] },
]

// ── 其他游戏题库 ──────────────────────────────────────────────
const COMPLIMENT_PROMPTS = [
  '夸TA的某个让你印象最深的优点',
  '说一件TA做过让你很感动的事',
  '夸TA的某个小习惯',
  '说TA哪里让你觉得很安心',
  '夸TA的某次勇敢或努力',
  '说TA哪句话让你记到现在',
  '夸TA对你最好的一次',
  '说TA身上你最欣赏的品质',
]

const TRUTH_QUESTIONS = [
  '你第一次对我心动是什么时候？',
  '你觉得我最大的缺点是什么？',
  '如果可以改变我一件事，你会改什么？',
  '你有没有对我撒过谎？说一个。',
  '你最希望我能理解你的什么？',
  '你觉得我们最大的问题是什么？',
  '你有没有因为我做的某件事而感到委屈？',
  '你心里最希望我说的一句话是什么？',
  '你觉得我们最美好的回忆是哪一次？',
  '你有什么一直想跟我说但没说的话？',
]

const GUESS_PROMPTS = [
  '描述我们第一次约会时发生的一件趣事',
  '描述你最近一次为我做的一件小事',
  '描述一个只有我们知道的秘密时刻',
  '描述我们吵过最好笑的一次架',
  '描述你觉得我最可爱的一个小动作',
  '描述我们一起经历过的最难忘的事',
]

const DAILY_TASKS = [
  '今天互相发一条语音消息，说一件让你感动的小事',
  '一起做一顿饭，不用手机，只聊天',
  '各自写下对方三个最近让你开心的行为，然后交换',
  '今晚拥抱对方30秒，什么都不说',
  '给对方写一张手写便利贴，放在TA能看见的地方',
  '一起回忆你们在一起之前的一个难忘的细节',
  '今天，主动帮对方做一件TA通常自己做的事',
  '各自说出现在最想对对方说的一句话',
]

const ROLE_SWAP_SCENARIOS = [
  '用对方说话的口吻，描述你们上次争吵',
  '模仿对方，演示TA是怎么表达爱意的',
  '用对方的视角，说说为什么这件事让TA不开心',
  '模仿对方打招呼的方式',
  '用对方的语气，给自己提一个要改进的地方',
]

const GRATITUDE_PROMPTS = [
  '说一件对方做过的、你一直没说谢谢的事',
  '说出对方哪个习惯让你觉得很安心',
  '说一件因为有TA，你变好了的事',
  '说出你们在一起之后，你最大的一个改变',
  '说出对方哪一面，是你欣赏但很少说出口的',
  '说一次对方让你感到特别被爱的时刻',
]

const CREATIVE_QUESTIONS = [
  '如果你们的关系是一道菜，会是什么？为什么？',
  '如果你们的关系是一首歌，你会选哪首？',
  '你觉得10年后我们在做什么？',
  '如果只能带一件东西去荒岛，你会带我吗？',
  '我们关系最像哪部电影里的角色？',
  '如果你能改变我一件事，是什么？',
  '你觉得我们最大的共同点是什么？',
]

const MEMORY_QUESTIONS = [
  '我们第一次见面时你穿的什么？',
  '我们第一次吵架是因为什么？',
  '我做过的让你最感动的一件事是什么？',
  '我最喜欢吃什么？',
  '我最怕什么？',
  '我们第一次约会去哪？',
  '我有什么奇怪的小习惯？',
]

const WISHLIST_PROMPTS = [
  '你最想和我一起去哪个城市？',
  '你最想和我一起尝试什么新事物？',
  '你希望我们五年后在做什么？',
  '你最想和我一起完成的一件事是什么？',
  '你想养什么宠物？叫什么名字？',
  '你心里有什么一直想对我说但没说的？',
]


// 通用游戏 Modal
function LockSvg({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={11} width={18} height={11} rx={2} stroke={color} strokeWidth={1.8}/>
      <Path d="M7 11V7a5 5 0 0 1 10 0v4" stroke={color} strokeWidth={1.8} strokeLinecap="round"/>
    </Svg>
  )
}

function GameCardIcon({ icon, color }: { icon: string; color: string }) {
  const c = color
  if (icon === 'star') return <Svg width={24} height={24} viewBox="0 0 24 24" fill="none"><Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke={c} strokeWidth={1.6} fill={c+'22'}/></Svg>
  if (icon === 'chat') return <Svg width={24} height={24} viewBox="0 0 24 24" fill="none"><Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 0 2 2z" stroke={c} strokeWidth={1.6} fill={c+'22'}/></Svg>
  if (icon === 'think') return <Svg width={24} height={24} viewBox="0 0 24 24" fill="none"><Circle cx={12} cy={12} r={10} stroke={c} strokeWidth={1.6} fill={c+'22'}/><Path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" stroke={c} strokeWidth={1.8} strokeLinecap="round"/></Svg>
  if (icon === 'task') return <Svg width={24} height={24} viewBox="0 0 24 24" fill="none"><Rect x={3} y={3} width={18} height={18} rx={3} stroke={c} strokeWidth={1.6} fill={c+'22'}/><Path d="M9 12l2 2 4-4" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/></Svg>
  if (icon === 'swap') return <Svg width={24} height={24} viewBox="0 0 24 24" fill="none"><Path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" stroke={c} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"/></Svg>
  if (icon === 'heart') return <Svg width={24} height={24} viewBox="0 0 24 24" fill="none"><Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke={c} strokeWidth={1.6} fill={c+'22'}/></Svg>
  if (icon === 'memory') return <Svg width={24} height={24} viewBox="0 0 24 24" fill="none"><Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={c} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" fill={c+'22'}/></Svg>
  if (icon === 'wish') return <Svg width={24} height={24} viewBox="0 0 24 24" fill="none"><Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke={c} strokeWidth={1.6} fill={c+'22'}/><Circle cx={12} cy={12} r={3} fill={c} opacity={0.5}/></Svg>
  if (icon === 'task2') return <Svg width={24} height={24} viewBox="0 0 24 24" fill="none"><Path d="M9 11l3 3L22 4" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/><Path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" stroke={c} strokeWidth={1.6} strokeLinecap="round"/></Svg>
  if (icon === 'idea') return <Svg width={24} height={24} viewBox="0 0 24 24" fill="none"><Path d="M9 18h6M10 22h4M12 2a7 7 0 0 1 7 7c0 2.5-1.5 4.5-3 6H8c-1.5-1.5-3-3.5-3-6a7 7 0 0 1 7-7z" stroke={c} strokeWidth={1.6} strokeLinecap="round" fill={c+'22'}/></Svg>
  return null
}


function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}


function MediationTaskModal({ visible, onClose, nameA, nameB, onFinish, theme }: {
  visible: boolean; onClose: () => void; nameA: string; nameB: string; onFinish: () => void; theme: any
}) {
  const [task, setTask] = React.useState<string | null>(null)
  const [done, setDone] = React.useState(false)
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (visible && !task) loadTask()
  }, [visible])

  async function loadTask() {
    setLoading(true)
    try {
      const { loadRecentRecords } = await import('../../services/storage')
      const { chatCompletion } = await import('../../services/llm')
      const recs = await loadRecentRecords(3)
      const latest = recs[0]
      let prompt = ''
      if (latest?.report?.mediationSuggestion) {
        prompt = `基于这对情侣最近的调解建议：「${latest.report.mediationSuggestion}」

为${nameA}和${nameB}生成一个今日调解任务，要求：
1. 具体可执行，今天就能完成
2. 两人一起参与
3. 轻松不强迫
4. 只输出任务描述，50字以内`
      } else {
        prompt = `为情侣${nameA}和${nameB}生成一个今日感情维护小任务，具体可执行，两人一起完成，轻松有趣，50字以内，只输出任务内容`
      }
      const res = await chatCompletion([{ role: 'user', content: prompt }], null, { maxTokens: 100, temperature: 0.8 })
      setTask(res.content.trim())
    } catch {
      setTask('今天互相说一件最近觉得对方做得很好的事，不要超过30秒，认真听对方说完。')
    }
    setLoading(false)
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.6)', justifyContent:'center', alignItems:'center', padding:24 }}>
        <View style={{ backgroundColor: theme.bg4, borderRadius:20, padding:24, width:'100%', gap:16 }}>
          <Text style={{ fontSize:20, fontWeight:'700', color: theme.text, textAlign:'center' }}>今日调解任务</Text>
          <Text style={{ fontSize:12, color: theme.text3, textAlign:'center' }}>基于你们最近的对话分析生成</Text>
          {loading ? (
            <View style={{ alignItems:'center', paddingVertical:24 }}>
              <ActivityIndicator color={theme.primary} />
              <Text style={{ color: theme.text3, marginTop:8, fontSize:12 }}>AI 生成中…</Text>
            </View>
          ) : done ? (
            <View style={{ alignItems:'center', gap:12 }}>
              <Text style={{ fontSize:36 }}>🎉</Text>
              <Text style={{ fontSize:16, color: theme.text, textAlign:'center' }}>完成了！+60 经验值</Text>
              <TouchableOpacity onPress={() => { setDone(false); setTask(null); onFinish(); onClose() }}
                style={{ backgroundColor: theme.primary, borderRadius:12, paddingVertical:12, paddingHorizontal:24 }}>
                <Text style={{ color:'#fff', fontWeight:'600' }}>收下奖励</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={{ backgroundColor: theme.primaryDim, borderRadius:12, borderWidth:1, borderColor: theme.primary + '4d', padding:16 }}>
                <Text style={{ fontSize:15, color: theme.text, lineHeight:24, textAlign:'center' }}>{task}</Text>
              </View>
              <TouchableOpacity onPress={() => setDone(true)}
                style={{ backgroundColor: theme.primary, borderRadius:12, paddingVertical:14, alignItems:'center' }}>
                <Text style={{ fontSize:16, fontWeight:'600', color:'#fff' }}>我们完成了 ✓</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setTask(null); loadTask() }} style={{ alignItems:'center' }}>
                <Text style={{ fontSize:13, color: theme.text3 }}>换一个任务</Text>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity onPress={onClose} style={{ alignItems:'center' }}>
            <Text style={{ fontSize:13, color: theme.text3 }}>关闭</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

function MealCheckinCard({ checkins, onCheckin, onHistory, weekXP }: {
  checkins: string[]; onCheckin: () => void; onHistory: () => void; weekXP: number
}) {
  const today = todayStr()
  const checkedToday = checkins.includes(today)
  const weekCount = checkins.filter(d => (Date.now() - new Date(d).getTime()) / 86400000 < 7).length

  // 本周7天
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - 6 + i)
    const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    return { ds, checked: checkins.includes(ds), isToday: ds === today }
  })

  return (
    <LinearGradient colors={['#1a2a1a','#0f1f2a']} style={mc.card} start={{x:0,y:0}} end={{x:1,y:1}}>
      <View style={mc.header}>
        <View>
          <Text style={mc.title}>一起用餐打卡</Text>
          <Text style={mc.sub}>本周 {weekCount}/7 次 · 已获 {weekXP} 经验值</Text>
        </View>
        <TouchableOpacity
          style={[mc.btn, checkedToday && mc.btnDone]}
          onPress={checkedToday ? undefined : onCheckin}
          activeOpacity={checkedToday ? 1 : 0.8}
        >
          <Text style={mc.btnTxt}>{checkedToday ? '今日已打卡 ✓' : '+ 打卡'}</Text>
        </TouchableOpacity>
      </View>

      {/* 本周圆点 */}
      <View style={mc.weekRow}>
        {weekDays.map((d, i) => (
          <View key={i} style={mc.dayCol}>
            <View style={[mc.dot, d.checked && mc.dotChecked, d.isToday && mc.dotToday]}>
              {d.checked && <Text style={{fontSize:10}}>🍜</Text>}
            </View>
            <Text style={[mc.dayTxt, d.isToday && {color:'#4CAF7D'}]}>
              {['日','一','二','三','四','五','六'][new Date(d.ds).getDay()]}
            </Text>
          </View>
        ))}
      </View>

      <TouchableOpacity onPress={onHistory} style={mc.historyBtn}>
        <Text style={mc.historyBtnTxt}>查看月度记录 →</Text>
      </TouchableOpacity>
      <Text style={mc.hint}>每次用餐打卡 +10 经验值，本周最多 +50</Text>
    </LinearGradient>
  )
}

const mc = StyleSheet.create({
  card:     { borderRadius: 16, padding: 16, marginBottom: 4 },
  header:   { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:14 },
  title:    { fontSize:16, fontWeight:'700', color:'#fff', marginBottom:3 },
  sub:      { fontSize:12, color:'rgba(255,255,255,0.5)' },
  btn:      { backgroundColor:'#4CAF7D', borderRadius:20, paddingHorizontal:14, paddingVertical:8 },
  btnDone:  { backgroundColor:'rgba(76,175,125,0.2)', borderWidth:1, borderColor:'#4CAF7D' },
  btnTxt:   { fontSize:12, fontWeight:'600', color:'#fff' },
  weekRow:  { flexDirection:'row', justifyContent:'space-between', marginBottom:12 },
  dayCol:   { alignItems:'center', gap:5 },
  dot:      { width:32, height:32, borderRadius:16, backgroundColor:'rgba(255,255,255,0.08)', alignItems:'center', justifyContent:'center' },
  dotChecked: { backgroundColor:'rgba(76,175,125,0.3)', borderWidth:1.5, borderColor:'#4CAF7D' },
  dotToday:   { borderWidth:1.5, borderColor:'rgba(255,255,255,0.3)' },
  dayTxt:   { fontSize:10, color:'rgba(255,255,255,0.35)' },
  hint:     { fontSize:11, color:'rgba(255,255,255,0.3)', textAlign:'center' },
  historyBtn:    { alignItems:'center', paddingVertical:6 },
  historyBtnTxt: { fontSize:12, color:'rgba(255,255,255,0.45)', textDecorationLine:'underline' },
})

function GameCard({ icon, color, title, desc, locked, lockLevel, onPress, theme }: {
  icon: string; color: string; title: string; desc: string
  locked?: boolean; lockLevel?: number; onPress: () => void; theme: any
}) {
  return (
    <TouchableOpacity
      style={[s.gameCard, { backgroundColor: theme.bg3, borderColor: theme.border }, locked && { opacity: 0.5 }]}
      onPress={locked ? undefined : onPress}
      activeOpacity={locked ? 1 : 0.8}
    >
      <View style={{ marginBottom: 8 }}>
        {locked ? <LockSvg color={theme.text3} /> : <GameCardIcon icon={icon} color={color} />}
      </View>
      <Text style={[s.gameName, { color: theme.text }, locked && { color: theme.text3 }]}>{title}</Text>
      <Text style={[s.gameDesc, { color: theme.text3 }]}>{locked ? `${lockLevel}级解锁` : desc}</Text>
    </TouchableOpacity>
  )
}

function OtherGameModal({ visible, onClose, title, nameA, nameB, items, instruction, xp, onFinish, theme }: {
  visible: boolean; onClose: () => void; title: string;
  nameA: string; nameB: string; items: string[];
  instruction: string; xp: number; onFinish: () => void; theme: any
}) {
  const [current, setCurrent] = React.useState<string>('')
  const [used, setUsed] = React.useState<string[]>([])
  const [finished, setFinished] = React.useState(false)

  React.useEffect(() => {
    if (visible) { setCurrent(''); setUsed([]); setFinished(false) }
  }, [visible])

  function draw() {
    const remaining = items.filter(x => !used.includes(x))
    if (remaining.length === 0) { setFinished(true); return }
    const pick = remaining[Math.floor(Math.random() * remaining.length)]
    setCurrent(pick); setUsed(prev => [...prev, pick])
  }

  async function handleFinish() {
    await onFinish(); onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[og.modal, { backgroundColor: theme.bg }]}>
        <View style={[og.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={onClose}><Text style={[og.close, { color: theme.text2 }]}>✕ 退出</Text></TouchableOpacity>
          <Text style={[og.title, { color: theme.text }]}>{title}</Text>
          <View style={{width:60}}/>
        </View>
        <View style={og.body}>
          <View style={[og.instrCard, { backgroundColor: theme.bg3, borderColor: theme.border }]}>
            <Text style={[og.instrTxt, { color: theme.text2 }]}>{instruction}</Text>
          </View>
          {!finished ? (
            <>
              {current ? (
                <View style={og.cardWrap}>
                  <View style={[og.card, { backgroundColor: theme.bg3, borderColor: theme.border2 }]}>
                    <Text style={[og.cardTxt, { color: theme.text }]}>{current}</Text>
                  </View>
                  <Text style={[og.used, { color: theme.text3 }]}>已用 {used.length}/{items.length} 张</Text>
                </View>
              ) : (
                <View style={og.emptyCard}>
                  <Text style={[og.emptyTxt, { color: theme.text3 }]}>点击下方按钮抽题</Text>
                </View>
              )}
              <TouchableOpacity style={[og.drawBtn, { backgroundColor: theme.primary }]} onPress={draw}>
                <Text style={og.drawBtnTxt}>{current ? '下一题' : '开始抽题'} 🎲</Text>
              </TouchableOpacity>
              {used.length >= 3 && (
                <TouchableOpacity style={[og.doneBtn, { borderColor: theme.border2 }]} onPress={handleFinish}>
                  <Text style={[og.doneBtnTxt, { color: theme.text2 }]}>游戏结束，获得 +{xp} XP</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <View style={og.finishWrap}>
              <Svg width={52} height={52} viewBox="0 0 24 24" fill="none" style={{alignSelf:'center',marginBottom:16}}>
        <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke={theme.amber} strokeWidth={1.4} fill={theme.amber + '33'}/>
      </Svg>
              <Text style={[og.finishTxt, { color: theme.text2 }]}>题目都用完啦！</Text>
              <TouchableOpacity style={[og.drawBtn, { backgroundColor: theme.primary }]} onPress={handleFinish}>
                <Text style={og.drawBtnTxt}>完成，获得 +{xp} XP</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  )
}

const og = StyleSheet.create({
  modal: {flex:1},
  header: {flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingTop:56,paddingHorizontal:24,paddingBottom:16,borderBottomWidth:1},
  close: {fontSize:14},
  title: {fontSize:16,fontWeight:'600'},
  body: {flex:1,padding:24,gap:16},
  instrCard: {borderRadius:16,borderWidth:1,padding:16},
  instrTxt: {fontSize:13,lineHeight:20},
  cardWrap: {alignItems:'center',gap:8},
  card: {width:'100%',borderRadius:20,borderWidth:1,padding:28,alignItems:'center',minHeight:140,justifyContent:'center'},
  cardTxt: {fontSize:20,textAlign:'center',lineHeight:28,fontWeight:'500'},
  used: {fontSize:12},
  emptyCard: {flex:1,alignItems:'center',justifyContent:'center'},
  emptyTxt: {fontSize:15},
  drawBtn: {borderRadius:14,paddingVertical:15,alignItems:'center'},
  drawBtnTxt: {fontSize:16,fontWeight:'600',color:'#fff'},
  doneBtn: {borderRadius:14,borderWidth:1,paddingVertical:13,alignItems:'center'},
  doneBtnTxt: {fontSize:14},
  finishWrap: {flex:1,justifyContent:'center',gap:16},
  finishTxt: {fontSize:18,textAlign:'center'},
})

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pick5(): typeof QUESTION_POOL {
  return shuffle(QUESTION_POOL).slice(0, 5)
}

// ── 游戏状态机 ─────────────────────────────────────────────────
// phase:
//   idle → a_answering → b_judging → b_answering → a_judging → result
type GamePhase = 'idle' | 'a_answering' | 'b_judging' | 'b_answering' | 'a_judging' | 'result'

interface GameState {
  phase: GamePhase
  questionsForA: typeof QUESTION_POOL  // A 答关于 B 的题
  questionsForB: typeof QUESTION_POOL  // B 答关于 A 的题
  aAnswers: number[]    // A 的选择（索引）
  bAnswers: number[]    // B 的选择（索引）
  aScore: number        // B 判断 A 答对了几题
  bScore: number        // A 判断 B 答对了几题
  currentQ: number      // 当前题目索引（0-4）
  judgingIdx: number    // 当前判断到第几题
}

const initState = (): GameState => ({
  phase: 'idle',
  questionsForA: pick5(),
  questionsForB: pick5(),
  aAnswers: [],
  bAnswers: [],
  aScore: 0,
  bScore: 0,
  currentQ: 0,
  judgingIdx: 0,
})


function AnimatedBar({ pct, style, focusKey=0, color }: { pct: number; style?: any; focusKey?: number; color: string }) {
  const anim = React.useRef(new Animated.Value(0)).current
  React.useEffect(() => {
    anim.setValue(0)
    Animated.timing(anim, { toValue: pct, duration: 1000, delay: 200, useNativeDriver: false }).start()
  }, [pct, focusKey])
  const width = anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] })
  return (
    <View style={[{ backgroundColor:'rgba(255,255,255,0.08)', borderRadius:3, height:5, overflow:'hidden' }, style]}>
      <Animated.View style={{ height:'100%', backgroundColor: color, borderRadius:3, width }} />
    </View>
  )
}

export default function GamesScreen() {
  const { theme } = useTheme()
  const [games, setGames]     = useState<GamesState | null>(null)
  const [focusKey, setFocusKey] = useState(0)
  const [nameA, setNameA]     = useState('你')
  const [nameB, setNameB]     = useState('TA')
  const [gs, setGs]           = useState<GameState>(initState())
  const [showGame, setShowGame] = useState(false)
  const [otherGame, setOtherGame] = useState<'compliment'|'truth'|'guess'|'daily'|'role'|'gratitude'|'creative'|'memory'|'wish'|null>(null)
  const [showMealCheckin, setShowMealCheckin] = useState(false)
  const [showMealHistory, setShowMealHistory] = useState(false)
  const [mealCheckins, setMealCheckins] = useState<string[]>([])
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null)

  useFocusEffect(React.useCallback(() => {
    setFocusKey(k => k + 1)
    let a = true
    ;(async () => {
      const [g, p, checkins] = await Promise.all([loadGamesState(), loadProfile(), loadCheckins()])
      if (!a) return
      setMealCheckins(checkins.filter(c => c.type === 'meal').map(c => c.date))
      if (!a) return
      setGames(g)
      if (p) { setNameA(p.nameA); setNameB(p.nameB) }
    })()
    return () => { a = false }
  }, []))

  const progress = games ? levelProgress(games) : null

  function startGame() {
    setGs(initState())
    setSelectedOpt(null)
    setShowGame(true)
  }

  // A 选完一题
  function handleAAnswer(optIdx: number) {
    setSelectedOpt(optIdx)
    setTimeout(() => {
      const newAnswers = [...gs.aAnswers, optIdx]
      if (newAnswers.length < 5) {
        setGs(prev => ({ ...prev, aAnswers: newAnswers, currentQ: prev.currentQ + 1 }))
        setSelectedOpt(null)
      } else {
        // A 答完5题，进入 B 判断
        setGs(prev => ({ ...prev, aAnswers: newAnswers, phase: 'b_judging', judgingIdx: 0 }))
        setSelectedOpt(null)
      }
    }, 400)
  }

  // B 判断 A 的答案对不对
  function handleBJudge(correct: boolean) {
    Haptics.impactAsync(correct ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light)
    const newScore = gs.aScore + (correct ? 1 : 0)
    const nextIdx = gs.judgingIdx + 1
    if (nextIdx < 5) {
      setGs(prev => ({ ...prev, aScore: newScore, judgingIdx: nextIdx }))
    } else {
      // B 判断完，换 B 答题
      setGs(prev => ({ ...prev, aScore: newScore, phase: 'b_answering', currentQ: 0, judgingIdx: 0 }))
      setSelectedOpt(null)
    }
  }

  // B 选完一题
  function handleBAnswer(optIdx: number) {
    setSelectedOpt(optIdx)
    setTimeout(() => {
      const newAnswers = [...gs.bAnswers, optIdx]
      if (newAnswers.length < 5) {
        setGs(prev => ({ ...prev, bAnswers: newAnswers, currentQ: prev.currentQ + 1 }))
        setSelectedOpt(null)
      } else {
        setGs(prev => ({ ...prev, bAnswers: newAnswers, phase: 'a_judging', judgingIdx: 0 }))
        setSelectedOpt(null)
      }
    }, 400)
  }

  // A 判断 B 的答案对不对
  async function handleAJudge(correct: boolean) {
    Haptics.impactAsync(correct ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light)
    const newScore = gs.bScore + (correct ? 1 : 0)
    const nextIdx = gs.judgingIdx + 1
    if (nextIdx < 5) {
      setGs(prev => ({ ...prev, bScore: newScore, judgingIdx: nextIdx }))
    } else {
      // 游戏结束
      const totalXP = (gs.aScore + newScore) * 10
      const newGames = await addXP(totalXP)
      setGames(newGames)
      setGs(prev => ({ ...prev, bScore: newScore, phase: 'result' }))
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    }
  }

  // ── 渲染 Modal 内容 ────────────────────────────────────────────
  function renderGameContent() {
    const { phase, questionsForA, questionsForB, currentQ, judgingIdx, aAnswers, bAnswers, aScore, bScore } = gs

    // A 答题阶段
    if (phase === 'a_answering') {
      const q = questionsForA[currentQ]
      return (
        <View style={m.gameBody}>
          <View style={[m.handoffBanner, { backgroundColor: theme.bg3 }]}>
            <Text style={m.handoffEmoji}>📱</Text>
            <Text style={[m.handoffTxt, { color: theme.text }]}>把手机交给 <Text style={{color:theme.primary}}>{nameA}</Text></Text>
          </View>
          <Text style={[m.phaseLabel, { color: theme.text2 }]}>{nameA} 回答关于 {nameB} 的问题</Text>
          <Text style={[m.progress, { color: theme.text3 }]}>{currentQ + 1} / 5</Text>
          <View style={m.progressBar}><View style={[m.progressFill,{width:`${((currentQ)/5)*100}%`,backgroundColor:theme.primary}]}/></View>
          <Text style={[m.question, { color: theme.text }]}>{q.q.replace('TA', nameB)}</Text>
          <View style={m.opts}>
            {q.opts.map((opt, i) => (
              <TouchableOpacity key={i}
                style={[m.optBtn, { backgroundColor: theme.bg3, borderColor: theme.border2 }, selectedOpt === i && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                onPress={() => handleAAnswer(i)} activeOpacity={0.7}>
                <Text style={[m.optTxt, { color: theme.text }, selectedOpt === i && m.optTxtSelected]}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )
    }

    // B 判断 A 的答案
    if (phase === 'b_judging') {
      const q = questionsForA[judgingIdx]
      const aChoice = q.opts[aAnswers[judgingIdx]]
      return (
        <View style={m.gameBody}>
          <View style={[m.handoffBanner, { backgroundColor: theme.bg3 }]}>
            <Text style={m.handoffEmoji}>📱</Text>
            <Text style={[m.handoffTxt, { color: theme.text }]}>把手机交给 <Text style={{color:theme.secondary}}>{nameB}</Text></Text>
          </View>
          <Text style={[m.phaseLabel, { color: theme.text2 }]}>{nameB} 来判断 {nameA} 答对了吗</Text>
          <Text style={[m.progress, { color: theme.text3 }]}>{judgingIdx + 1} / 5</Text>
          <View style={m.progressBar}><View style={[m.progressFill,{width:`${(judgingIdx/5)*100}%`,backgroundColor:theme.secondary}]}/></View>
          <Text style={[m.question, { color: theme.text }]}>{q.q.replace('TA', nameB)}</Text>
          <View style={[m.judgeCard, { backgroundColor: theme.bg3, borderColor: theme.border }]}>
            <Text style={[m.judgeLabel, { color: theme.text2 }]}>{nameA} 的答案是：</Text>
            <Text style={[m.judgeAnswer, { color: theme.text }]}>{aChoice}</Text>
          </View>
          <Text style={[m.judgeQuestion, { color: theme.text2 }]}>这个答案正确吗？</Text>
          <View style={{flexDirection:'row',gap:12}}>
            <TouchableOpacity style={[m.judgeBtn, m.judgeBtnCorrect, { borderColor: theme.green }]} onPress={() => handleBJudge(true)}>
              <Text style={[m.judgeBtnTxt, { color: theme.text }]}>✓ 答对了</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[m.judgeBtn, m.judgeBtnWrong, { borderColor: theme.red }]} onPress={() => handleBJudge(false)}>
              <Text style={[m.judgeBtnTxt, { color: theme.text }]}>✕ 答错了</Text>
            </TouchableOpacity>
          </View>
          <Text style={[m.scoreHint, { color: theme.text3 }]}>当前得分：{nameA} {aScore}分</Text>
        </View>
      )
    }

    // B 答题阶段
    if (phase === 'b_answering') {
      const q = questionsForB[currentQ]
      return (
        <View style={m.gameBody}>
          <View style={[m.handoffBanner, { backgroundColor: theme.bg3 }]}>
            <Text style={m.handoffEmoji}>📱</Text>
            <Text style={[m.handoffTxt, { color: theme.text }]}>把手机交给 <Text style={{color:theme.secondary}}>{nameB}</Text></Text>
          </View>
          <Text style={[m.phaseLabel, { color: theme.text2 }]}>{nameB} 回答关于 {nameA} 的问题</Text>
          <Text style={[m.progress, { color: theme.text3 }]}>{currentQ + 1} / 5</Text>
          <View style={m.progressBar}><View style={[m.progressFill,{width:`${((currentQ)/5)*100}%`,backgroundColor:theme.secondary}]}/></View>
          <Text style={[m.question, { color: theme.text }]}>{q.q.replace('TA', nameA)}</Text>
          <View style={m.opts}>
            {q.opts.map((opt, i) => (
              <TouchableOpacity key={i}
                style={[m.optBtn, { backgroundColor: theme.bg3, borderColor: theme.border2 }, selectedOpt === i && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                onPress={() => handleBAnswer(i)} activeOpacity={0.7}>
                <Text style={[m.optTxt, { color: theme.text }, selectedOpt === i && m.optTxtSelected]}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )
    }

    // A 判断 B 的答案
    if (phase === 'a_judging') {
      const q = questionsForB[judgingIdx]
      const bChoice = q.opts[bAnswers[judgingIdx]]
      return (
        <View style={m.gameBody}>
          <View style={[m.handoffBanner, { backgroundColor: theme.bg3 }]}>
            <Text style={m.handoffEmoji}>📱</Text>
            <Text style={[m.handoffTxt, { color: theme.text }]}>把手机交给 <Text style={{color:theme.primary}}>{nameA}</Text></Text>
          </View>
          <Text style={[m.phaseLabel, { color: theme.text2 }]}>{nameA} 来判断 {nameB} 答对了吗</Text>
          <Text style={[m.progress, { color: theme.text3 }]}>{judgingIdx + 1} / 5</Text>
          <View style={m.progressBar}><View style={[m.progressFill,{width:`${(judgingIdx/5)*100}%`,backgroundColor:theme.primary}]}/></View>
          <Text style={[m.question, { color: theme.text }]}>{q.q.replace('TA', nameA)}</Text>
          <View style={[m.judgeCard, { backgroundColor: theme.bg3, borderColor: theme.border }]}>
            <Text style={[m.judgeLabel, { color: theme.text2 }]}>{nameB} 的答案是：</Text>
            <Text style={[m.judgeAnswer, { color: theme.text }]}>{bChoice}</Text>
          </View>
          <Text style={[m.judgeQuestion, { color: theme.text2 }]}>这个答案正确吗？</Text>
          <View style={{flexDirection:'row',gap:12}}>
            <TouchableOpacity style={[m.judgeBtn, m.judgeBtnCorrect, { borderColor: theme.green }]} onPress={() => handleAJudge(true)}>
              <Text style={[m.judgeBtnTxt, { color: theme.text }]}>✓ 答对了</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[m.judgeBtn, m.judgeBtnWrong, { borderColor: theme.red }]} onPress={() => handleAJudge(false)}>
              <Text style={[m.judgeBtnTxt, { color: theme.text }]}>✕ 答错了</Text>
            </TouchableOpacity>
          </View>
          <Text style={[m.scoreHint, { color: theme.text3 }]}>当前得分：{nameB} {bScore}分</Text>
        </View>
      )
    }

    // 结果
    if (phase === 'result') {
      const total = aScore + bScore
      const emoji = total >= 8 ? '🥰' : total >= 5 ? '😊' : '🤔'
      const comment = total >= 8 ? '你们真的超级了解对方！' : total >= 5 ? '还不错，继续加深了解~' : '还有很多要探索的呢！'
      return (
        <View style={m.gameBody}>
          <Text style={{fontSize:64, textAlign:'center', marginBottom:16}}>{emoji}</Text>
          <Text style={[m.resultTitle, { color: theme.text }]}>游戏结束！</Text>
          <Text style={[m.resultComment, { color: theme.text2 }]}>{comment}</Text>
          <View style={[m.resultScores, { backgroundColor: theme.bg3, borderColor: theme.border }]}>
            <View style={m.resultScoreCard}>
              <Text style={[m.resultName, { color: theme.text2 }]}>{nameA}</Text>
              <Text style={[m.resultScore,{color:theme.primary}]}>{aScore}<Text style={{fontSize:16}}>/5</Text></Text>
              <Text style={[m.resultScoreLabel, { color: theme.text3 }]}>被猜中</Text>
            </View>
            <View style={[m.resultDivider, { backgroundColor: theme.border }]}/>
            <View style={m.resultScoreCard}>
              <Text style={[m.resultName, { color: theme.text2 }]}>{nameB}</Text>
              <Text style={[m.resultScore,{color:theme.secondary}]}>{bScore}<Text style={{fontSize:16}}>/5</Text></Text>
              <Text style={[m.resultScoreLabel, { color: theme.text3 }]}>被猜中</Text>
            </View>
          </View>
          <Text style={[m.xpEarned, { color: theme.amber }]}>+{(aScore + bScore) * 10} 经验值</Text>
          <TouchableOpacity style={[m.restartBtn, { backgroundColor: theme.bg3, borderColor: theme.border2 }]} onPress={() => { setGs(initState()); setSelectedOpt(null) }}>
            <Text style={[m.restartTxt, { color: theme.text2 }]}>再来一局</Text>
          </TouchableOpacity>
        </View>
      )
    }

    return null
  }

  return (
    <>
      <ScrollView style={[s.screen, { backgroundColor: theme.bg }]} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={[s.title, { color: theme.text }]}>情侣小游戏</Text>
        <Text style={[s.sub, { color: theme.text2 }]}>赚取积分，解锁新的恋爱成就！</Text>

        {/* 主游戏卡片 */}
        <TouchableOpacity onPress={startGame} activeOpacity={0.85}>
          <LinearGradient colors={theme.gradientPrimary as any} style={s.featured} start={{x:0,y:0}} end={{x:1,y:1}}>
            <View style={s.xpBadge}><Text style={[s.xpTxt, { color: theme.text }]}>最高 +100 经验值</Text></View>
            <Svg width={44} height={44} viewBox="0 0 24 24" fill="none" style={{marginBottom:12}}>
              <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke={theme.primary} strokeWidth={1.2} fill={theme.primaryDim}/>
            </Svg>
            <Text style={[s.featuredTitle, { color: theme.text }]}>你有多懂我？</Text>
            <Text style={s.featuredDesc}>双人互答 · 由对方判断对错 · 各答5题</Text>
            <View style={[s.startBtn, { backgroundColor: theme.primary }]}><Text style={s.startBtnTxt}>立即挑战</Text></View>
          </LinearGradient>
        </TouchableOpacity>

        {/* 用餐打卡 */}
        <MealCheckinCard
          checkins={mealCheckins}
          onCheckin={() => setShowMealCheckin(true)}
          onHistory={() => setShowMealHistory(true)}
          weekXP={Math.min(mealCheckins.filter(d => (Date.now() - new Date(d).getTime()) / 86400000 < 7).length * 10, 50)}
        />

        {/* 基础游戏 */}
        <Text style={[s.unlockSectionTitle, { color: theme.text3 }]}>情侣游戏</Text>
        <View style={s.grid}>
          <GameCard icon="star"  color={theme.amber}  title="夸夸大作战"    desc="轮流夸对方，说不出来的输" onPress={() => setOtherGame('compliment')} theme={theme} />
          <GameCard icon="chat"  color={theme.secondary} title="真心话大冒险"  desc="随机问题，必须回答"        onPress={() => setOtherGame('truth')} theme={theme} />
        </View>
        <View style={s.grid}>
          <GameCard icon="think" color={theme.green}  title="猜猜我在想什么" desc="描述一件事，对方来猜"    onPress={() => setOtherGame('guess')} theme={theme} />
          <GameCard icon="task"  color={theme.primary}
            title="今日甜蜜任务" desc="完成一个小任务，积累甜蜜值"
            locked={!games?.unlockedGames.includes('daily_task')}
            lockLevel={5}
            onPress={() => setOtherGame('daily')} theme={theme} />
        </View>

        {/* 解锁游戏 — 每5级一个 */}
        <Text style={[s.unlockSectionTitle, { color: theme.text3 }]}>解锁游戏</Text>
        <View style={s.grid}>
          <GameCard icon="swap"  color="#FF8C69"
            title="角色互换" desc="用对方的视角说话"
            locked={!games?.unlockedGames.includes('role_swap')}
            lockLevel={10}
            onPress={() => setOtherGame('role')} theme={theme} />
          <GameCard icon="heart" color={theme.primary}
            title="感恩日记" desc="说出藏在心里的谢谢"
            locked={!games?.unlockedGames.includes('gratitude')}
            lockLevel={15}
            onPress={() => setOtherGame('gratitude')} theme={theme} />
        </View>
        <View style={s.grid}>
          <GameCard icon="idea"  color={theme.secondary}
            title="创意提问" desc="AI出奇怪又有趣的问题"
            locked={!games?.unlockedGames.includes('creative_q')}
            lockLevel={20}
            onPress={() => setOtherGame('creative')} theme={theme} />
          <GameCard icon="memory" color={theme.green}
            title="甜蜜记忆" desc="考验你们的共同回忆"
            locked={!games?.unlockedGames.includes('memory_q')}
            lockLevel={25}
            onPress={() => setOtherGame('memory')} theme={theme} />
        </View>
        <View style={s.grid}>
          <GameCard icon="wish"  color={theme.amber}
            title="愿望清单" desc="说出你们的共同愿望"
            locked={!games?.unlockedGames.includes('wish_q')}
            lockLevel={30}
            onPress={() => setOtherGame('wish')} theme={theme} />
        </View>

        {/* 等级 */}
        {games && progress && (
          <View style={[s.levelCard, { backgroundColor: theme.bg3, borderColor: theme.border }]}>
            <View style={[s.levelAvatar, { backgroundColor: theme.primaryDim }]}>
                <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
                  <Path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402C1 3.134 4.445 1 7.5 1c2.031 0 3.5 1 4.5 2 1-1 2.469-2 4.5-2C19.555 1 23 3.134 23 6.191c0 4.105-5.37 8.863-11 14.402z" stroke={theme.primary} strokeWidth={1.6} fill={theme.primaryDim}/>
                </Svg>
              </View>
            <View style={{flex:1}}>
              <Text style={[s.levelTitle, { color: theme.text }]}>恋爱等级 <Text style={{color:theme.primary}}>{games.level}</Text></Text>
              <AnimatedBar pct={progress.pct} style={s.barWrap} focusKey={focusKey} color={theme.primary} />
              <Text style={[s.levelXP, { color: theme.primary }]}>{progress.current} / {progress.required} 经验值</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* 游戏 Modal */}
      <Modal visible={showGame} animationType="slide" presentationStyle="pageSheet">
        <View style={[m.modal, { backgroundColor: theme.bg }]}>
          <View style={[m.modalHeader, { borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={() => setShowGame(false)} style={m.closeBtn}>
              <Text style={[m.closeTxt, { color: theme.text2 }]}>✕ 退出</Text>
            </TouchableOpacity>
            <Text style={[m.modalTitle, { color: theme.text }]}>你有多懂我？</Text>
            <View style={{width:60}}/>
          </View>

          {gs.phase === 'idle' && (
            <View style={m.gameBody}>
              <Svg width={56} height={56} viewBox="0 0 24 24" fill="none" style={{alignSelf:'center',marginBottom:20}}>
              <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke={theme.primary} strokeWidth={1} fill={theme.primaryDim}/>
            </Svg>
              <Text style={[m.introTitle, { color: theme.text }]}>游戏规则</Text>
              <View style={[m.ruleCard, { backgroundColor: theme.bg3, borderColor: theme.border }]}>
                <Text style={[m.ruleTxt, { color: theme.text2 }]}>1. {nameA} 先回答 5 道关于 {nameB} 的题目</Text>
                <Text style={[m.ruleTxt, { color: theme.text2 }]}>2. {nameB} 逐题判断对错（你真正的答案）</Text>
                <Text style={[m.ruleTxt, { color: theme.text2 }]}>3. 换 {nameB} 回答关于 {nameA} 的题目</Text>
                <Text style={[m.ruleTxt, { color: theme.text2 }]}>4. {nameA} 来判断对错</Text>
                <Text style={[m.ruleTxt, { color: theme.text2 }]}>5. 答对1题得10经验值</Text>
              </View>
              <TouchableOpacity style={[m.startBigBtn, { backgroundColor: theme.primary }]}
                onPress={() => setGs(prev => ({ ...prev, phase: 'a_answering' }))}>
                <Text style={m.startBigBtnTxt}>开始游戏</Text>
              </TouchableOpacity>
            </View>
          )}

          {gs.phase !== 'idle' && renderGameContent()}
        </View>
      </Modal>
      {/* 夸夸大作战 */}
      <OtherGameModal
        visible={otherGame === 'compliment'}
        onClose={() => setOtherGame(null)}
        title="夸夸大作战 ⭐"
        nameA={nameA} nameB={nameB}
        items={COMPLIMENT_PROMPTS}
        instruction="轮流夸对方，说不出来就输了。先从一句开始，越夸越具体！"
        xp={30}
        onFinish={async () => { const g = await addXP(30); setGames(g) }}
        theme={theme}
      />
      {/* 真心话大冒险 */}
      <OtherGameModal
        visible={otherGame === 'truth'}
        onClose={() => setOtherGame(null)}
        title="真心话大冒险 💬"
        nameA={nameA} nameB={nameB}
        items={TRUTH_QUESTIONS}
        instruction="抽到问题必须真实回答，对方来判断是否诚实。"
        xp={40}
        onFinish={async () => { const g = await addXP(40); setGames(g) }}
        theme={theme}
      />
      {/* 今日甜蜜任务 */}
      <OtherGameModal
        visible={otherGame === 'daily'}
        onClose={() => setOtherGame(null)}
        title="今日甜蜜任务 💝"
        nameA={nameA} nameB={nameB}
        items={DAILY_TASKS}
        instruction="今天和TA一起完成这个小任务，积累甜蜜值！"
        xp={40}
        onFinish={async () => { const g = await addXP(40); setGames(g) }}
        theme={theme}
      />
      {/* 猜猜我在想什么 */}
      <OtherGameModal
        visible={otherGame === 'guess'}
        onClose={() => setOtherGame(null)}
        title="猜猜我在想什么 🔮"
        nameA={nameA} nameB={nameB}
        items={GUESS_PROMPTS}
        instruction="A 描述一件关于两人的事，B 来猜是什么。"
        xp={35}
        onFinish={async () => { const g = await addXP(35); setGames(g) }}
        theme={theme}
      />

      {/* 角色互换 */}
      <OtherGameModal
        visible={otherGame === 'role'}
        onClose={() => setOtherGame(null)}
        title="角色互换 🔄"
        nameA={nameA} nameB={nameB}
        items={ROLE_SWAP_SCENARIOS}
        instruction="用对方的口吻和视角来表达，感受TA的感受。"
        xp={50}
        onFinish={async () => { const g = await addXP(50); setGames(g) }}
        theme={theme}
      />
      {/* 感恩日记 */}
      <OtherGameModal
        visible={otherGame === 'gratitude'}
        onClose={() => setOtherGame(null)}
        title="感恩日记 💌"
        nameA={nameA} nameB={nameB}
        items={GRATITUDE_PROMPTS}
        instruction="说出那些藏在心里、一直没说出口的感谢。"
        xp={45}
        onFinish={async () => { const g = await addXP(45); setGames(g) }}
        theme={theme}
      />
      {/* 创意提问 */}
      <OtherGameModal
        visible={otherGame === 'creative'}
        onClose={() => setOtherGame(null)}
        title="创意提问 💡"
        nameA={nameA} nameB={nameB}
        items={CREATIVE_QUESTIONS}
        instruction="用有趣的问题，发现对方身上的新面貌。"
        xp={35}
        onFinish={async () => { const g = await addXP(35); setGames(g) }}
        theme={theme}
      />
      {/* 甜蜜记忆 */}
      <OtherGameModal
        visible={otherGame === 'memory'}
        onClose={() => setOtherGame(null)}
        title="甜蜜记忆 🛡️"
        nameA={nameA} nameB={nameB}
        items={MEMORY_QUESTIONS}
        instruction="考验你们对彼此的记忆，答不出来要接受对方定的惩罚！"
        xp={35}
        onFinish={async () => { const g = await addXP(35); setGames(g) }}
        theme={theme}
      />
      {/* 愿望清单 */}
      <OtherGameModal
        visible={otherGame === 'wish'}
        onClose={() => setOtherGame(null)}
        title="愿望清单 ⭐"
        nameA={nameA} nameB={nameB}
        items={WISHLIST_PROMPTS}
        instruction="说出你心里的愿望，听听对方的回答，也许会有惊喜！"
        xp={35}
        onFinish={async () => { const g = await addXP(35); setGames(g) }}
        theme={theme}
      />
      {/* 今日调解任务 */}
      <MediationTaskModal
        visible={otherGame === 'mediation'}
        onClose={() => setOtherGame(null)}
        nameA={nameA} nameB={nameB}
        onFinish={async () => { const g = await addXP(60); setGames(g) }}
        theme={theme}
      />
      {/* 用餐历史弹窗 */}
      <Modal visible={showMealHistory} transparent animationType="slide" onRequestClose={() => setShowMealHistory(false)}>
        <View style={{flex:1,backgroundColor:'rgba(0,0,0,0.6)',justifyContent:'flex-end'}}>
          <View style={{backgroundColor:theme.bg4,borderTopLeftRadius:24,borderTopRightRadius:24,maxHeight:'80%'}}>
            <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',padding:20,borderBottomWidth:1,borderBottomColor:theme.border}}>
              <Text style={{fontSize:18,fontWeight:'700',color:theme.text}}>用餐记录</Text>
              <TouchableOpacity onPress={() => setShowMealHistory(false)}>
                <Text style={{fontSize:16,color:theme.text3}}>关闭</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{padding:20,gap:8}} showsVerticalScrollIndicator={false}>
              {(() => {
                // 按月分组
                const byMonth: Record<string, string[]> = {}
                ;[...mealCheckins].sort((a,b) => b.localeCompare(a)).forEach(d => {
                  const m = d.slice(0,7)
                  if (!byMonth[m]) byMonth[m] = []
                  byMonth[m].push(d)
                })
                return Object.entries(byMonth).map(([month, dates]) => (
                  <View key={month} style={{marginBottom:16}}>
                    <Text style={{fontSize:13,color:theme.text3,marginBottom:8}}>
                      {month.replace('-','年')}月 · {dates.length}次
                    </Text>
                    <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
                      {dates.map(d => (
                        <View key={d} style={{backgroundColor:theme.green + '33',borderRadius:8,borderWidth:1,borderColor:theme.green + '66',paddingHorizontal:10,paddingVertical:6}}>
                          <Text style={{fontSize:13,color:theme.green}}>{d.slice(5)} 🍜</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))
              })()}
              {mealCheckins.length === 0 && (
                <Text style={{color:theme.text3,textAlign:'center',paddingVertical:40}}>还没有用餐记录</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
      {/* 用餐打卡弹窗 */}
      <Modal visible={showMealCheckin} transparent animationType="fade" onRequestClose={() => setShowMealCheckin(false)}>
        <View style={{flex:1,backgroundColor:'rgba(0,0,0,0.6)',justifyContent:'center',alignItems:'center',padding:24}}>
          <View style={{backgroundColor:theme.bg4,borderRadius:20,padding:24,width:'100%',gap:16}}>
            <Text style={{fontSize:20,fontWeight:'700',color:theme.text,textAlign:'center'}}>今天一起吃饭了吗？</Text>
            <Text style={{fontSize:14,color:theme.text2,textAlign:'center'}}>打卡记录你们的每一餐，每次 +10 经验值</Text>
            <TouchableOpacity
              style={{backgroundColor:theme.green,borderRadius:12,paddingVertical:14,alignItems:'center'}}
              onPress={async () => {
                const today = todayStr()
                if (mealCheckins.includes(today)) { setShowMealCheckin(false); return }
                const rec: CheckinRecord = {
                  id: generateId(), date: today, type: 'meal', label: '用餐', createdAt: Date.now()
                }
                await saveCheckin(rec)
                const g = await addXP(10)
                setGames(g)
                setMealCheckins(prev => [...prev, today])
                setShowMealCheckin(false)
              }}
            >
              <Text style={{fontSize:16,fontWeight:'600',color:'#fff'}}>打卡 🍜 +10 经验值</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowMealCheckin(false)} style={{alignItems:'center',paddingVertical:8}}>
              <Text style={{fontSize:14,color:theme.text3}}>今天还没吃，取消</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  )
}

const s = StyleSheet.create({
  screen: {flex:1},
  content: {paddingHorizontal:spacing.xxl,paddingTop:64,paddingBottom:40,gap:16},
  title: {fontSize:26,fontWeight:'700'},
  sub: {fontSize:13,marginTop:-10},
  featured: {borderRadius:radius.xl,padding:spacing.xl,borderWidth:1,borderColor:'rgba(155,127,232,0.3)',position:'relative',overflow:'hidden'},
  xpBadge: {position:'absolute',top:20,right:20,backgroundColor:'rgba(255,255,255,0.12)',borderRadius:radius.full,paddingHorizontal:12,paddingVertical:4},
  xpTxt: {fontSize:11},
  featuredTitle: {fontSize:22,fontWeight:'700',marginBottom:6},
  featuredDesc: {fontSize:13,color:'rgba(255,255,255,0.6)',marginBottom:18},
  startBtn: {borderRadius:13,paddingVertical:13,alignItems:'center'},
  startBtnTxt: {fontSize:16,fontWeight:'600',color:'#fff'},
  grid: {flexDirection:'row',gap:12},
  unlockSectionTitle: {fontSize:13,marginTop:4,marginBottom:4},
  gameCard: {flex:1,borderRadius:radius.lg,borderWidth:1,padding:spacing.lg},
  gameName: {fontSize:14,fontWeight:'600',marginBottom:4},
  gameDesc: {fontSize:11},
  levelCard: {borderRadius:radius.lg,borderWidth:1,padding:spacing.lg,flexDirection:'row',alignItems:'center',gap:14},
  levelAvatar: {width:48,height:48,borderRadius:24,alignItems:'center',justifyContent:'center'},
  levelTitle: {fontSize:14,fontWeight:'500',marginBottom:8},
  barWrap: {backgroundColor:'rgba(255,255,255,0.08)',borderRadius:3,height:5,overflow:'hidden'},
  bar: {height:'100%',borderRadius:3},
  levelXP: {fontSize:11,marginTop:5},
})

const m = StyleSheet.create({
  modal: {flex:1},
  modalHeader: {flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingTop:56,paddingHorizontal:spacing.xxl,paddingBottom:16,borderBottomWidth:1},
  closeBtn: {},
  closeTxt: {fontSize:14},
  modalTitle: {fontSize:16,fontWeight:'600'},
  gameBody: {flex:1,paddingHorizontal:spacing.xxl,paddingTop:24,paddingBottom:40},
  handoffBanner: {flexDirection:'row',alignItems:'center',gap:8,borderRadius:radius.md,padding:12,marginBottom:20},
  handoffEmoji: {fontSize:20},
  handoffTxt: {fontSize:14},
  phaseLabel: {fontSize:13,marginBottom:4},
  progress: {fontSize:13,marginBottom:8},
  progressBar: {height:4,backgroundColor:'rgba(255,255,255,0.08)',borderRadius:2,marginBottom:24,overflow:'hidden'},
  progressFill: {height:'100%',borderRadius:2},
  question: {fontSize:22,fontWeight:'700',lineHeight:30,marginBottom:28},
  opts: {gap:12},
  optBtn: {borderRadius:radius.md,borderWidth:1,paddingVertical:15,paddingHorizontal:20},
  optTxt: {fontSize:16},
  optTxtSelected: {color:'#fff',fontWeight:'600'},
  judgeCard: {borderRadius:radius.lg,padding:16,marginBottom:16,borderWidth:1},
  judgeLabel: {fontSize:12,marginBottom:6},
  judgeAnswer: {fontSize:24,fontWeight:'700'},
  judgeQuestion: {fontSize:16,marginBottom:16,textAlign:'center'},
  judgeBtn: {flex:1,borderRadius:radius.md,paddingVertical:14,alignItems:'center'},
  judgeBtnCorrect: {backgroundColor:'rgba(76,175,125,0.25)',borderWidth:1},
  judgeBtnWrong: {backgroundColor:'rgba(255,82,82,0.15)',borderWidth:1},
  judgeBtnTxt: {fontSize:16,fontWeight:'600'},
  scoreHint: {fontSize:12,textAlign:'center',marginTop:16},
  resultTitle: {fontSize:28,fontWeight:'700',textAlign:'center',marginBottom:8},
  resultComment: {fontSize:15,textAlign:'center',marginBottom:28},
  resultScores: {flexDirection:'row',borderRadius:radius.xl,borderWidth:1,overflow:'hidden',marginBottom:20},
  resultScoreCard: {flex:1,alignItems:'center',paddingVertical:20},
  resultDivider: {width:1},
  resultName: {fontSize:13,marginBottom:8},
  resultScore: {fontSize:40,fontWeight:'700'},
  resultScoreLabel: {fontSize:11,marginTop:4},
  xpEarned: {fontSize:14,textAlign:'center',fontWeight:'600',marginBottom:20},
  restartBtn: {borderRadius:radius.md,borderWidth:1,paddingVertical:13,alignItems:'center'},
  restartTxt: {fontSize:15},
  introTitle: {fontSize:20,fontWeight:'700',marginBottom:16},
  ruleCard: {borderRadius:radius.lg,borderWidth:1,padding:16,gap:10,marginBottom:28},
  ruleTxt: {fontSize:14,lineHeight:22},
  startBigBtn: {borderRadius:radius.md,paddingVertical:15,alignItems:'center'},
  startBigBtnTxt: {fontSize:17,fontWeight:'600',color:'#fff'},
})
