// app/(tabs)/history.tsx
import React, { useState, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Animated } from 'react-native'
import { useFocusEffect, router } from 'expo-router'
import Svg, { Rect, Text as SvgText } from 'react-native-svg'
import { spacing, radius } from '../../constants/theme'
import { useTheme } from '../../contexts/ThemeContext'
import { loadRecentRecords, computeWeeklyStats, deleteRecord, type ConversationRecord } from '../../services/storage'

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']


// 柱形图从下往上弹起动画
function AnimatedBars({ bars, maxBar, focusKey, color }: { bars: {day:string,val:number}[], maxBar: number, focusKey: number, color: string }) {
  const anims = React.useRef(bars.map(() => new Animated.Value(0))).current
  React.useEffect(() => {
    // 每次 focusKey 变化时先重置再动画
    anims.forEach(a => a.setValue(0))
    Animated.stagger(60, anims.map((a, i) => {
      const barH = bars[i].val > 0 ? Math.max(8, (bars[i].val / Math.max(maxBar,1)) * 60) : 8
      return Animated.spring(a, { toValue: barH + 4, friction: 6, tension: 80, useNativeDriver: false })
    })).start()
  }, [focusKey])

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 80, paddingHorizontal: 8, gap: 0 }}>
      {bars.map((b, i) => {
        const opacity = b.val > 0 ? 0.7 + (b.val / Math.max(maxBar,1)) * 0.3 : 0.2
        return (
          <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: 80 }}>
            <Animated.View style={{
              width: 28, borderRadius: 5,
              backgroundColor: color,
              opacity,
              height: anims[i],
              marginBottom: 4,
            }}/>
            <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>{b.day}</Text>
          </View>
        )
      })}
    </View>
  )
}

export default function HistoryScreen() {
  const { theme } = useTheme()
  const [records, setRecords] = useState<ConversationRecord[]>([])
  const [focusKey, setFocusKey] = useState(0)
  const [stats, setStats]     = useState<{ daily: Record<string, number>; sweetCount: number; conflictCount: number }>({ daily: {}, sweetCount: 0, conflictCount: 0 })

  useFocusEffect(useCallback(() => {
    setFocusKey(k => k + 1)
    let active = true
    ;(async () => {
      const [recs, s] = await Promise.all([loadRecentRecords(), computeWeeklyStats()])
      if (!active) return
      setRecords(recs); setStats(s)
    })()
    return () => { active = false }
  }, []))

  async function handleDelete(id: string) {
    Alert.alert('删除记录', '确定要删除这条记录吗？', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: async () => {
        await deleteRecord(id)
        setRecords(prev => prev.filter(r => r.id !== id))
      }},
    ])
  }

  function fmtDate(ts: number) {
    const d = new Date(ts)
    return `${d.getMonth()+1}月${d.getDate()}日 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  }
  function fmtDuration(s: number) { return `${Math.floor(s/60)}分${s%60}秒` }

  // Build week bar data
  const today = new Date()
  const weekBars = DAYS.map((day, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1) + i)
    const key = d.toISOString().slice(0, 10)
    return { day, val: stats.daily[key] ?? 0 }
  })
  const maxBar = Math.max(...weekBars.map(b => b.val), 1)

  return (
    <ScrollView style={[styles.screen, { backgroundColor: theme.bg }]} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={[styles.title, { color: theme.text }]}>历史记录</Text>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: theme.bg3, borderColor: theme.border }]}>
          <Text style={[styles.statNum, { color: theme.text }]}>{stats.sweetCount}</Text>
          <Text style={[styles.statLabel, { color: theme.primary }]}>甜蜜时刻</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.bg3, borderColor: theme.border }]}>
          <Text style={[styles.statNum, { color: theme.text }]}>{stats.conflictCount}</Text>
          <Text style={[styles.statLabel, { color: theme.secondary }]}>需要沟通</Text>
        </View>
      </View>

      {/* Week chart */}
      <View style={[styles.chartCard, { backgroundColor: theme.bg3, borderColor: theme.border }]}>
        <Text style={[styles.chartLabel, { color: theme.text2 }]}>爱情趋势</Text>
        <AnimatedBars bars={weekBars} maxBar={maxBar} focusKey={focusKey} color={theme.primary} />
      </View>

      {/* Record list */}
      {records.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🎙️</Text>
          <Text style={[styles.emptyTxt, { color: theme.text2 }]}>还没有记录</Text>
          <Text style={[styles.emptySubTxt, { color: theme.text3 }]}>点击下方麦克风开始第一次对话分析</Text>
        </View>
      ) : (
        <>
          <Text style={[styles.sectionLabel, { color: theme.text2 }]}>最近记录</Text>
          {records.map(rec => {
            const isConflict = rec.report.category === 'conflict'
            return (
              <TouchableOpacity
                key={rec.id}
                style={[styles.recCard, { backgroundColor: theme.bg3, borderColor: theme.border }]}
                onPress={() => router.push(`/report/${rec.id}`)}
                onLongPress={() => handleDelete(rec.id)}
                activeOpacity={0.7}
              >
                <View style={styles.recHeader}>
                  <View style={[styles.recIcon, { backgroundColor: isConflict ? 'rgba(255,82,82,0.2)' : theme.primaryDim, borderColor: isConflict ? theme.red : theme.primary }]}>
                    <Text style={styles.recIconEmoji}>{isConflict ? '🌶️' : '💕'}</Text>
                  </View>
                  <View style={styles.recInfo}>
                    <Text style={[styles.recTitle, { color: theme.text }]}>{rec.report.categoryLabel}</Text>
                    <View style={styles.recMeta}>
                      <Text style={[styles.recMetaTxt, { color: theme.text3 }]}>⏱ {fmtDuration(rec.duration)}</Text>
                      {isConflict && (
                        <View style={styles.fireBadge}>
                          <Text style={[styles.fireTxt, { color: theme.red }]}>🌶 火药味</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Text style={[styles.recDate, { color: theme.text3 }]}>{fmtDate(rec.createdAt)}</Text>
                </View>
                <View style={styles.recBarWrap}>
                  <View style={[styles.recBar, {
                    width: `${rec.report.harmonyScore}%`,
                    backgroundColor: isConflict ? theme.red : theme.primary,
                  }]} />
                </View>
                <Text style={[styles.recHarmony, { color: theme.text3 }]}>默契度 {rec.report.harmonyScore}%</Text>
              </TouchableOpacity>
            )
          })}
          <Text style={[styles.hintTxt, { color: theme.text3 }]}>长按记录可删除</Text>
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen:  { flex: 1 },
  content: { paddingHorizontal: spacing.xxl, paddingTop: 64, paddingBottom: 40, gap: 14 },
  title:   { fontSize: 26, fontWeight: '700' },
  statsRow:{ flexDirection: 'row', gap: 12 },
  statCard:{ flex: 1, borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, alignItems: 'center' },
  statNum: { fontSize: 24, fontWeight: '700' },
  statLabel:{ fontSize: 10, marginTop: 2 },
  chartCard:{ borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg },
  chartLabel:{ fontSize: 13, marginBottom: 12 },
  sectionLabel:{ fontSize: 13 },
  empty:   { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyEmoji:{ fontSize: 48 },
  emptyTxt:{ fontSize: 16, fontWeight: '500' },
  emptySubTxt:{ fontSize: 13, textAlign: 'center' },
  recCard: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg },
  recHeader:{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  recIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  recIconConflict:{ backgroundColor: 'rgba(255,82,82,0.15)' },
  recIconEmoji:{ fontSize: 16 },
  recInfo: { flex: 1 },
  recTitle:{ fontSize: 15, fontWeight: '500' },
  recMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  recMetaTxt:{ fontSize: 11 },
  fireBadge:{ backgroundColor: 'rgba(255,82,82,0.12)', borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(255,82,82,0.3)' },
  fireTxt: { fontSize: 10 },
  recDate: { fontSize: 11 },
  recBarWrap:{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, height: 4, overflow: 'hidden', marginBottom: 6 },
  recBar:  { height: '100%', borderRadius: 3 },
  recHarmony:{ fontSize: 11 },
  hintTxt: { fontSize: 11, textAlign: 'center' },
})
