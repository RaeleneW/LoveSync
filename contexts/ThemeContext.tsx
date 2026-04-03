// contexts/ThemeContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { ThemeName, themes, ThemeColors } from '../constants/themes'
import { loadTheme, saveTheme } from '../services/themeService'

interface ThemeContextType {
  theme: ThemeColors
  themeName: ThemeName
  setTheme: (name: ThemeName) => Promise<void>
}

const ThemeContext = createContext<ThemeContextType | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeName, setThemeName] = useState<ThemeName>('default')
  const [theme, setTheme] = useState<ThemeColors>(themes.default)

  useEffect(() => {
    loadTheme().then(name => {
      setThemeName(name)
      setTheme(themes[name])
    })
  }, [])

  const handleSetTheme = async (name: ThemeName) => {
    setThemeName(name)
    setTheme(themes[name])
    await saveTheme(name)
  }

  return (
    <ThemeContext.Provider value={{ theme, themeName, setTheme: handleSetTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}