// constants/theme.ts
export const colors = {
  bg:       '#0A0A0C',
  bg2:      '#111115',
  bg3:      '#18181E',
  bg4:      '#1E1E26',
  bg5:      '#242430',
  pink:     '#FF6B9D',
  pinkDim:  'rgba(255,107,157,0.15)',
  purple:   '#9B7FE8',
  purpleDim:'rgba(155,127,232,0.2)',
  text:     '#F0EEF8',
  text2:    '#A09CB8',
  text3:    '#5C5878',
  border:   'rgba(255,255,255,0.07)',
  border2:  'rgba(255,255,255,0.12)',
  red:      '#FF5252',
  green:    '#4CAF7D',
  amber:    '#FFB347',
} as const

export const fonts = {
  regular: undefined,   // system default
  medium:  undefined,
  bold:    undefined,
} as const

export const radius = {
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  xxl: 24,
  full: 999,
} as const

export const spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  xxl: 24,
  xxxl:32,
} as const
