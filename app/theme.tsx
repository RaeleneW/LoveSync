// app/theme.tsx
import React, { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, Alert,
} from 'react-native'
import { router } from 'expo-router'
import { useTheme } from '../contexts/ThemeContext'
import { ThemeName, themes } from '../constants/themes'
import Svg, { Path } from 'react-native-svg'

const { width: SCREEN_W } = Dimensions.get('window')

const themeOptions: { name: ThemeName; label: string }[] = [
  { name: 'default', label: '默认粉紫' },
  { name: 'warmApricot', label: '暖杏紫调' },
  { name: 'mintCoral', label: '薄荷珊瑚' },
]

export default function ThemeScreen() {
  const { theme, themeName, setTheme } = useTheme()

  const handleSelect = (name: ThemeName) => {
    if (name === themeName) return

    const t = themes[name]
    Alert.alert(
      '切换主题',
      `确认更换为「${t.themeLabel}」主题吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认',
          onPress: async () => {
            await setTheme(name)
          }
        },
      ]
    )
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: theme.bg3, borderColor: theme.border }]}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path d="M19 12H5M12 19l-7-7 7-7" stroke={theme.text2} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
          </Svg>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>主题设置</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {themeOptions.map((opt) => {
          const t = themes[opt.name]
          const isSelected = themeName === opt.name
          return (
            <TouchableOpacity
              key={opt.name}
              style={[styles.card, { backgroundColor: theme.bg3, borderColor: isSelected ? t.primary : theme.border, borderWidth: isSelected ? 2 : 1 }]}
              onPress={() => handleSelect(opt.name)}
              activeOpacity={0.8}
            >
              <View style={styles.cardLeft}>
                {/* 颜色色块 */}
                <View style={styles.colorRow}>
                  <View style={[styles.colorBlock, { backgroundColor: t.primary }]} />
                  <View style={[styles.colorBlock, { backgroundColor: t.secondary }]} />
                  <View style={[styles.colorBlock, { backgroundColor: t.bg }]} />
                  <View style={[styles.colorBlock, { backgroundColor: t.bg3 }]} />
                </View>
              </View>
              <View style={styles.cardRight}>
                <Text style={[styles.cardLabel, { color: theme.text }]}>{opt.label}</Text>
                {isSelected && (
                  <View style={[styles.checkMark, { backgroundColor: t.primary }]}>
                    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                      <Path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"/>
                    </Svg>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )
        })}

        {/* 当前主题色值展示 */}
        <View style={[styles.section, { backgroundColor: theme.bg3, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>当前主题色值</Text>
          <View style={styles.colorInfo}>
            <View style={styles.colorInfoRow}>
              <View style={[styles.colorDot, { backgroundColor: theme.primary }]} />
              <Text style={[styles.colorText, { color: theme.text2 }]}>主色: {theme.primary}</Text>
            </View>
            <View style={styles.colorInfoRow}>
              <View style={[styles.colorDot, { backgroundColor: theme.secondary }]} />
              <Text style={[styles.colorText, { color: theme.text2 }]}>次色: {theme.secondary}</Text>
            </View>
            <View style={styles.colorInfoRow}>
              <View style={[styles.colorDot, { backgroundColor: theme.bg }]} />
              <Text style={[styles.colorText, { color: theme.text2 }]}>背景: {theme.bg}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  title: { fontSize: 20, fontWeight: '700' },
  content: { paddingHorizontal: 20, paddingBottom: 48, gap: 12 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, padding: 16,
  },
  cardLeft: { flex: 1 },
  colorRow: {
    flexDirection: 'row', gap: 8,
  },
  colorBlock: {
    width: 44, height: 44, borderRadius: 10,
  },
  cardRight: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  cardLabel: { fontSize: 15, fontWeight: '500' },
  checkMark: {
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  section: {
    marginTop: 8, padding: 16, borderRadius: 14, borderWidth: 1,
  },
  sectionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 12 },
  colorInfo: { gap: 10 },
  colorInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  colorDot: { width: 16, height: 16, borderRadius: 8 },
  colorText: { fontSize: 13 },
})