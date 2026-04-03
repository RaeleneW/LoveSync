// components/EmotionChart.tsx — 从左往右绘制动画（遮罩揭开）
import React, { useEffect, useRef, useState } from 'react'
import { Animated, useWindowDimensions } from 'react-native'
import Svg, { Path, Line, Text as SvgText, Circle, Defs, ClipPath, Rect } from 'react-native-svg'
import type { EmotionPoint } from '../services/storage'

interface Props {
  data: EmotionPoint[]
  totalDuration?: number
  width?: number
  height?: number
  theme: any
}

function stretchValues(vals: number[], lo: number, hi: number): number[] {
  const mn = Math.min(...vals), mx = Math.max(...vals)
  if (mx - mn < 3) {
    return vals.map((_, i) => {
      const t = i / Math.max(vals.length - 1, 1)
      return Math.round(lo + (0.5 + 0.5 * Math.sin(t * Math.PI * 3 - Math.PI / 2)) * (hi - lo))
    })
  }
  return vals.map(v => Math.round(lo + ((v - mn) / (mx - mn)) * (hi - lo)))
}

function catmullRomPath(pts: [number, number][]): string {
  if (pts.length < 2) return ''
  let d = `M ${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(i + 2, pts.length - 1)]
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`
  }
  return d
}

export default function EmotionChart({ data, totalDuration, width, height = 160, theme }: Props) {
  const { width: screenW } = useWindowDimensions()
  const chartWidth = width ?? screenW - 48

  const revealAnim = useRef(new Animated.Value(0)).current
  const [clipW, setClipW] = useState(0)

  useEffect(() => {
    revealAnim.setValue(0)
    const id = revealAnim.addListener(({ value }) => setClipW(value))
    Animated.timing(revealAnim, {
      toValue: chartWidth,
      duration: 1500,
      delay: 300,
      useNativeDriver: false,
    }).start()
    return () => revealAnim.removeListener(id)
  }, [chartWidth])

  if (!data || data.length === 0) return null

  let pts = [...data].sort((a, b) => a.timestamp - b.timestamp)
  const dur = (totalDuration && totalDuration > 0)
    ? totalDuration
    : Math.max(pts[pts.length - 1]?.timestamp ?? 0, 30)

  if (pts.length < 8) {
    const expanded: typeof pts = []
    for (let i = 0; i < 8; i++) {
      const t = i / 7
      const srcIdx = t * (pts.length - 1)
      const lo = Math.floor(srcIdx), hi = Math.ceil(srcIdx)
      const f = srcIdx - lo
      const a = pts[Math.min(lo, pts.length - 1)]
      const b = pts[Math.min(hi, pts.length - 1)]
      expanded.push({
        timestamp: Math.round(t * dur),
        speakerA: Math.round(a.speakerA + (b.speakerA - a.speakerA) * f),
        speakerB: Math.round(a.speakerB + (b.speakerB - a.speakerB) * f),
        isFlashpoint: f < 0.3 ? a.isFlashpoint : false,
      })
    }
    pts = expanded
  } else {
    pts = pts.map((p, i) => ({ ...p, timestamp: Math.round((i / (pts.length - 1)) * dur) }))
  }

  const aS = stretchValues(pts.map(p => p.speakerA), 10, 92)
  const bS = stretchValues(pts.map(p => p.speakerB), 8, 68)
  pts = pts.map((p, i) => ({ ...p, speakerA: aS[i], speakerB: bS[i] }))

  const fps = pts.filter(p => p.isFlashpoint)
  const pX = 14, pY = 14, lblH = 20
  const cW = chartWidth - pX * 2
  const cH = height - pY * 2 - lblH

  const tx = (t: number) => pX + (t / Math.max(dur, 1)) * cW
  const ty = (v: number) => pY + cH - (Math.max(0, Math.min(100, v)) / 100) * cH

  const coordsA: [number, number][] = pts.map(p => [tx(p.timestamp), ty(p.speakerA)])
  const coordsB: [number, number][] = pts.map(p => [tx(p.timestamp), ty(p.speakerB)])
  const pathA = catmullRomPath(coordsA)
  const pathB = catmullRomPath(coordsB)

  const lblCount = 5
  const lbls = Array.from({ length: lblCount }, (_, i) => {
    const t = Math.round((i / (lblCount - 1)) * dur)
    const m = Math.floor(t / 60), s = Math.floor(t % 60)
    return { x: tx(t), label: `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` }
  })

  // 根据主题是深色还是浅色决定网格和文字颜色
  const gridColorMain = theme.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
  const gridColorSub = theme.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'
  const labelColor = theme.isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'

  return (
    <Svg width={chartWidth} height={height}>
      <Defs>
        {/* 从左往右揭开的裁剪区域 */}
        <ClipPath id="reveal">
          <Rect x={0} y={0} width={clipW} height={height} />
        </ClipPath>
      </Defs>

      {/* 网格线（不需要动画，直接显示） */}
      {[0.25, 0.5, 0.75].map((f, i) => (
        <Line key={i}
          x1={pX} y1={pY + cH * (1 - f)}
          x2={chartWidth - pX} y2={pY + cH * (1 - f)}
          stroke={f === 0.5 ? gridColorMain : gridColorSub}
          strokeWidth={f === 0.5 ? 1 : 0.5}
          strokeDasharray={f === 0.5 ? '4,4' : undefined}
        />
      ))}

      {/* 时间标签（不动画） */}
      {lbls.map((l, i) => (
        <SvgText key={i}
          x={l.x} y={height - 4}
          textAnchor={i === 0 ? 'start' : i === lblCount - 1 ? 'end' : 'middle'}
          fontSize={9} fill={labelColor}
        >{l.label}</SvgText>
      ))}

      {/* 用 clipPath 揭开曲线和数据点 */}
      <Path d={pathB} fill="none"
        stroke={theme.secondary} strokeWidth={2}
        strokeDasharray="8,5" strokeLinecap="round"
        opacity={0.8} clipPath="url(#reveal)"
      />
      <Path d={pathA} fill="none"
        stroke={theme.primary} strokeWidth={2.5}
        strokeLinecap="round" clipPath="url(#reveal)"
      />
      {coordsA.map(([x, y], i) => (
        x <= clipW ? <Circle key={i} cx={x} cy={y} r={2.5} fill={theme.primary} opacity={0.85} /> : null
      ))}
      {fps.map((p, i) => (
        tx(p.timestamp) <= clipW
          ? <SvgText key={i}
              x={tx(p.timestamp)}
              y={ty(Math.max(p.speakerA, p.speakerB)) - 8}
              textAnchor="middle" fontSize={18}
            >🔥</SvgText>
          : null
      ))}
    </Svg>
  )
}
