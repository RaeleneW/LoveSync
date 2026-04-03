// services/themeService.ts
import AsyncStorage from '@react-native-async-storage/async-storage'
import { ThemeName, themes, ThemeColors } from '../constants/themes'

const THEME_KEY = 'lovesync:theme'

// 保存主题设置
export async function saveTheme(themeName: ThemeName): Promise<void> {
  await AsyncStorage.setItem(THEME_KEY, themeName)
}

// 加载主题设置
export async function loadTheme(): Promise<ThemeName> {
  const saved = await AsyncStorage.getItem(THEME_KEY)
  if (saved && saved in themes) {
    return saved as ThemeName
  }
  return 'default'
}

// 获取主题配置
export function getThemeConfig(themeName: ThemeName): ThemeColors {
  return themes[themeName]
}