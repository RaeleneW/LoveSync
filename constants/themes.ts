// constants/themes.ts - 多主题配色方案
import { LinearGradient } from 'expo-linear-gradient'

export type ThemeName = 'default' | 'warmApricot' | 'mintCoral'

export interface ThemeColors {
  // 背景
  bg: string
  bg2: string
  bg3: string
  bg4: string
  bg5: string
  // 主色
  primary: string
  primaryDim: string
  // 次色
  secondary: string
  secondaryDim: string
  // 文字
  text: string
  text2: string
  text3: string
  // 边框
  border: string
  border2: string
  // 功能色
  red: string
  green: string
  amber: string
  // 渐变相关
  gradientPrimary: string[]
  gradientSecondary: string[]
  gradientAccent: string[]
  // 主题信息
  themeName: ThemeName
  themeLabel: string
  isDark: boolean
}

// 默认粉紫主题（原版）
export const defaultTheme: ThemeColors = {
  bg:       '#0A0A0C',
  bg2:      '#111115',
  bg3:      '#18181E',
  bg4:      '#1E1E26',
  bg5:      '#242430',
  primary:     '#FF6B9D',
  primaryDim:  'rgba(255,107,157,0.15)',
  secondary:   '#9B7FE8',
  secondaryDim:'rgba(155,127,232,0.2)',
  text:     '#F0EEF8',
  text2:    '#A09CB8',
  text3:    '#5C5878',
  border:   'rgba(255,255,255,0.07)',
  border2:  'rgba(255,255,255,0.12)',
  red:      '#FF5252',
  green:    '#4CAF7D',
  amber:    '#FFB347',
  gradientPrimary: ['#2a1a4a', '#3d1f60'], // 深紫渐变（原版）
  gradientSecondary: ['#9B7FE8', '#B09AE8'],
  gradientAccent: ['#FF6B9D', '#9B7FE8'],
  themeName: 'default',
  themeLabel: '默认粉紫',
  isDark: true,
}

// 暖杏紫调主题
export const warmApricotTheme: ThemeColors = {
  bg:       '#EADACB',
  bg2:      '#F5EBE0',
  bg3:      '#FFFFFF',
  bg4:      '#FAF5F0',
  bg5:      '#F0E8E0',
  primary:     '#746097',
  primaryDim:  'rgba(116,96,151,0.12)',
  secondary:   '#AD86AE',
  secondaryDim:'rgba(173,134,174,0.15)',
  text:     '#3D3428',
  text2:    '#5C4A3A',
  text3:    '#8B7355',
  border:   'rgba(116,96,151,0.12)',
  border2:  'rgba(116,96,151,0.2)',
  red:      '#C06060',
  green:    '#6B8E6B',
  amber:    '#B8860B',
  gradientPrimary: ['#EADACB', '#C4A8D4'], // 杏色→紫色
  gradientSecondary: ['#ECD9ED', '#AD86AE'],
  gradientAccent: ['#EADACB', '#ECD9ED'],
  themeName: 'warmApricot',
  themeLabel: '暖杏紫调',
  isDark: false,
}

// 薄荷珊瑚渐变主题
export const mintCoralTheme: ThemeColors = {
  bg:       '#d1e8e8',
  bg2:      '#e8f4f4',
  bg3:      '#FFFFFF',
  bg4:      '#f0f9f9',
  bg5:      '#e0f0f0',
  primary:     '#4A7c7c',
  primaryDim:  'rgba(74,124,124,0.12)',
  secondary:   '#b8e0d2',
  secondaryDim:'rgba(184,224,210,0.25)',
  text:     '#3D5c5c',
  text2:    '#4A7c7c',
  text3:    '#6b9a9a',
  border:   'rgba(74,124,124,0.12)',
  border2:  'rgba(74,124,124,0.2)',
  red:      '#e07060',
  green:    '#5a9a8a',
  amber:    '#d4a060',
  // 渐变配色
  gradientPrimary: ['#b8e0d2', '#d1e8e8', '#ffceb5'], // 薄荷→浅青→珊瑚
  gradientSecondary: ['#b8e0d2', '#95d5c2'], // 薄荷渐变
  gradientAccent: ['#ffb4a8', '#ff9a8b', '#ff8a7a'], // 珊瑚渐变
  themeName: 'mintCoral',
  themeLabel: '薄荷珊瑚',
  isDark: false,
}

// 主题映射
export const themes: Record<ThemeName, ThemeColors> = {
  default: defaultTheme,
  warmApricot: warmApricotTheme,
  mintCoral: mintCoralTheme,
}

// 为了向后兼容，导出一个 colors 引用（会在运行时替换）
export let colors = defaultTheme

// 主题切换函数
export function setTheme(themeName: ThemeName) {
  colors = themes[themeName]
}

// 获取主题
export function getTheme(themeName: ThemeName): ThemeColors {
  return themes[themeName]
}