// components/UI.tsx
import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ViewStyle, TextStyle, Image } from 'react-native'
import { radius, spacing } from '../constants/theme'

// ── Card ─────────────────────────────────────────────────────
export function Card({ children, style, theme }: { children: React.ReactNode; style?: ViewStyle; theme?: any }) {
  return <View style={[styles.card, theme && { backgroundColor: theme.bg3, borderColor: theme.border }, style]}>{children}</View>
}

// ── Section title ─────────────────────────────────────────────
export function SectionTitle({ icon, title, theme }: { icon?: string; title: string; theme?: any }) {
  return (
    <View style={styles.sectionTitle}>
      {icon && <Text style={styles.sectionIcon}>{icon}</Text>}
      <Text style={[styles.sectionTitleText, theme && { color: theme.text }]}>{title}</Text>
    </View>
  )
}

// ── Button ────────────────────────────────────────────────────
interface ButtonProps {
  label: string
  onPress: () => void
  variant?: 'primary' | 'ghost' | 'danger'
  loading?: boolean
  disabled?: boolean
  style?: ViewStyle
  theme?: any
}
export function Button({ label, onPress, variant = 'primary', loading, disabled, style, theme }: ButtonProps) {
  const primaryColor = theme?.primary ?? '#FF6B9D'
  const redColor = theme?.red ?? '#FF5252'
  const textColor = theme?.text ?? '#E8E4F0'
  const borderColor = theme?.border2 ?? 'rgba(255,255,255,0.12)'

  const bg = variant === 'primary' ? primaryColor
    : variant === 'danger' ? 'rgba(255,82,82,0.15)'
    : 'transparent'
  const border = variant === 'danger' ? 'rgba(255,82,82,0.3)'
    : variant === 'ghost' ? borderColor
    : 'transparent'
  const txtColor = variant === 'danger' ? redColor : textColor

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      style={[styles.button, { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.5 : 1 }, style]}
    >
      {loading
        ? <ActivityIndicator color={textColor} size="small" />
        : <Text style={[styles.buttonText, { color: txtColor }]}>{label}</Text>
      }
    </TouchableOpacity>
  )
}

// ── Score badge ───────────────────────────────────────────────
export function ScoreBadge({ value, label, color, theme }: { value: number; label: string; color?: string; theme?: any }) {
  const textColor = theme?.text ?? '#E8E4F0'
  const text2Color = theme?.text2 ?? '#C4BEDD'
  return (
    <View style={styles.scoreBadge}>
      <Text style={[styles.scoreNum, { color: color ?? textColor }]}>{value}%</Text>
      <Text style={[styles.scoreLabel, { color: text2Color }]}>{label}</Text>
    </View>
  )
}

// ── Trend indicator ───────────────────────────────────────────
export function TrendRow({ label, direction, theme }: { label: string; direction: 'up' | 'down' | 'stable'; theme?: any }) {
  const redColor = theme?.red ?? '#FF5252'
  const primaryColor = theme?.primary ?? '#FF6B9D'
  const text2Color = theme?.text2 ?? '#C4BEDD'
  const text3Color = theme?.text3 ?? '#8B8B9E'

  const arrow = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→'
  const arrowColor = direction === 'up' ? redColor : direction === 'down' ? primaryColor : text3Color
  const word = direction === 'up' ? '上升' : direction === 'down' ? '下降' : '平稳'
  return (
    <View style={styles.trendRow}>
      <Text style={[styles.trendLabel, { color: text2Color }]}>{label}</Text>
      <Text style={[styles.trendVal, { color: arrowColor }]}>{arrow} {word}</Text>
    </View>
  )
}

// ── Category badge ────────────────────────────────────────────
export function CategoryBadge({ category, theme }: { category: 'sweet' | 'conflict' | 'neutral'; theme?: any }) {
  const primaryColor = theme?.primary ?? '#FF6B9D'
  const redColor = theme?.red ?? '#FF5252'
  const borderColor = theme?.border ?? 'rgba(255,255,255,0.08)'
  const text2Color = theme?.text2 ?? '#C4BEDD'

  const cfg = {
    sweet:    { bg: primaryColor + '26', border: primaryColor + '4d', color: primaryColor,  label: '💕 甜蜜时刻' },
    conflict: { bg: redColor + '1f', border: redColor + '4d', color: redColor, label: '🌶️ 火药味' },
    neutral:  { bg: 'rgba(255,255,255,0.06)', border: borderColor, color: text2Color, label: '💬 日常聊天' },
  }[category]
  return (
    <View style={[styles.catBadge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
      <Text style={[styles.catText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  )
}

// ── Divider ───────────────────────────────────────────────────
export function Divider({ style, theme }: { style?: ViewStyle; theme?: any }) {
  const borderColor = theme?.border ?? 'rgba(255,255,255,0.08)'
  return <View style={[styles.divider, { backgroundColor: borderColor }, style]} />
}

// ── Avatar pair ───────────────────────────────────────────────
function AvatarDisplay({ uri, name, borderColor, theme }: { uri?: string; name: string; borderColor: string; theme?: any }) {
  const bg4Color = theme?.bg4 ?? '#1A1A1F'
  const text2Color = theme?.text2 ?? '#C4BEDD'
  return (
    <View style={styles.avatarCol}>
      <View style={[styles.avatarRing, { borderColor, backgroundColor: bg4Color }]}>
        {uri ? (
          <Image source={{ uri }} style={styles.avatarImg} />
        ) : (
          <View style={styles.avatarInitial}>
            <Text style={[styles.avatarInitialTxt, { color: borderColor }]}>
              {name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </View>
      <Text style={[styles.avatarName, { color: text2Color }]}>{name}</Text>
    </View>
  )
}

export function AvatarPair({ nameA, nameB, score, scoreLabel, avatarA, avatarB, theme }: {
  nameA: string; nameB: string; score: number; scoreLabel: string
  avatarA?: string; avatarB?: string; theme?: any
}) {
  const primaryColor = theme?.primary ?? '#FF6B9D'
  const secondaryColor = theme?.secondary ?? '#9B7FE8'
  const textColor = theme?.text ?? '#E8E4F0'
  const text2Color = theme?.text2 ?? '#C4BEDD'
  return (
    <View style={styles.avatarPair}>
      <AvatarDisplay uri={avatarA} name={nameA} borderColor={primaryColor} theme={theme} />
      <View style={styles.avatarScore}>
        <Text style={[styles.avatarScoreNum, { color: textColor }]}>{score}%</Text>
        <Text style={[styles.avatarScoreLabel, { color: text2Color }]}>{scoreLabel}</Text>
      </View>
      <AvatarDisplay uri={avatarB} name={nameB} borderColor={secondaryColor} theme={theme} />
    </View>
  )
}

// ── Legend ────────────────────────────────────────────────────
export function Legend({ items, theme }: { items: Array<{ color: string; label: string }>; theme?: any }) {
  const text2Color = theme?.text2 ?? '#C4BEDD'
  return (
    <View style={styles.legend}>
      {items.map((item, i) => (
        <View key={i} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: item.color }]} />
          <Text style={[styles.legendLabel, { color: text2Color }]}>{item.label}</Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
  },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionIcon: { fontSize: 16 },
  sectionTitleText: { fontSize: 15, fontWeight: '600' },
  button: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 16, fontWeight: '600' },
  scoreBadge: { alignItems: 'center' },
  scoreNum: { fontSize: 40, fontWeight: '700', lineHeight: 44 },
  scoreLabel: { fontSize: 12, marginTop: 4 },
  trendRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  trendLabel: { fontSize: 12 },
  trendVal: { fontSize: 12, fontWeight: '600' },
  catBadge: { borderRadius: radius.full, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  catText: { fontSize: 12, fontWeight: '500' },
  divider: { height: 1, marginHorizontal: spacing.xxl, marginVertical: 4 },
  avatarPair: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xxl, paddingVertical: spacing.lg },
  avatarCol: { alignItems: 'center', gap: 6 },
  avatarRing: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: 60, height: 60, borderRadius: 30 },
  avatarInitial: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  avatarInitialTxt: { fontSize: 22, fontWeight: '700' },
  avatarName: { fontSize: 13 },
  avatarScore: { alignItems: 'center' },
  avatarScoreNum: { fontSize: 40, fontWeight: '700' },
  avatarScoreLabel: { fontSize: 12, marginTop: 2 },
  legend: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 12 },
})