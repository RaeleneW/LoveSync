// components/RadarChart.tsx — 带入场动画
import React, { useEffect, useRef } from 'react'
import { Animated, View } from 'react-native'
import Svg, { Polygon, Line, Text, Circle, G } from 'react-native-svg'
import type { RadarData } from '../services/storage'

interface Props {
  dataA: RadarData
  dataB: RadarData
  size?: number
  theme: any
}

const LABELS = ['共情力', '逻辑性', '攻击性', '倾听欲', '防御性']
const KEYS: (keyof RadarData)[] = ['empathy', 'logic', 'aggression', 'listeningDesire', 'defensiveness']
const N = 5

function polarToXY(angle: number, r: number, cx: number, cy: number) {
  const rad = (angle - 90) * (Math.PI / 180)
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function getPoints(data: RadarData, cx: number, cy: number, maxR: number, scale: number): string {
  return KEYS.map((key, i) => {
    const angle = (360 / N) * i
    const r = (data[key] / 100) * maxR * scale
    const { x, y } = polarToXY(angle, r, cx, cy)
    return `${x},${y}`
  }).join(' ')
}

function gridPoints(level: number, cx: number, cy: number, maxR: number): string {
  return Array.from({ length: N }, (_, i) => {
    const angle = (360 / N) * i
    const { x, y } = polarToXY(angle, (level / 4) * maxR, cx, cy)
    return `${x},${y}`
  }).join(' ')
}

// AnimatedPolygon via opacity + scale workaround (SVG doesn't support Animated directly)
export default function RadarChart({ dataA, dataB, size = 220, theme }: Props) {
  const cx = size / 2
  const cy = size / 2
  const maxR = size * 0.38
  const opacity = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.3)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
    ]).start()
  }, [])

  // 根据主题是深色还是浅色决定网格和文字颜色
  const gridColor = theme.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'
  const axisColor = theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const labelColor = theme.isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'

  return (
    <View style={{ alignItems: 'center' }}>
      {/* 静态网格不动画 */}
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        {[1, 2, 3, 4].map(l => (
          <Polygon key={l} points={gridPoints(l, cx, cy, maxR)}
            fill="none" stroke={gridColor} strokeWidth={1} />
        ))}
        {KEYS.map((_, i) => {
          const angle = (360 / N) * i
          const { x, y } = polarToXY(angle, maxR, cx, cy)
          return <Line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={axisColor} strokeWidth={1} />
        })}
        {LABELS.map((label, i) => {
          const angle = (360 / N) * i
          const labelR = maxR + 22
          const { x, y } = polarToXY(angle, labelR, cx, cy)
          return (
            <Text key={i} x={x} y={y + 4} textAnchor="middle"
              fontSize={11} fill={labelColor}>{label}</Text>
          )
        })}
        <Circle cx={cx} cy={cy} r={3} fill={theme.text3} />
      </Svg>
      {/* 数据图形有动画 */}
      <Animated.View style={{ opacity, transform: [{ scale: scaleAnim }] }}>
        <Svg width={size} height={size}>
          <Polygon
            points={getPoints(dataB, cx, cy, maxR, 1)}
            fill={theme.secondary + '2e'}
            stroke={theme.secondary}
            strokeWidth={1.8}
          />
          <Polygon
            points={getPoints(dataA, cx, cy, maxR, 1)}
            fill={theme.primary + '2e'}
            stroke={theme.primary}
            strokeWidth={1.8}
          />
        </Svg>
      </Animated.View>
    </View>
  )
}
