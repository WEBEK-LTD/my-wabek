// Lagoon palette — the same tokens as the WABEK web app (styles/globals.css).
export const C = {
  // deep (dark surfaces)
  deep: '#04282C',
  deepest: '#021A1D',
  deep2: '#0E6C72',
  forest: '#1D6B4A',
  onDeep: '#EAF7F5',
  onDeepMuted: 'rgba(234,247,245,0.68)',
  onDeepFaint: 'rgba(234,247,245,0.45)',
  glass: 'rgba(234,247,245,0.06)',
  glassBorder: 'rgba(234,247,245,0.14)',
  // brand
  teal: '#12B5BE',
  tealLight: '#5FE3EA',
  green: '#8BE07A',
  brandInk: '#0B8A92',
  // light surfaces
  bg: '#F2F6F5',
  surface: '#FFFFFF',
  surface2: '#F7FAF9',
  line: '#DDE8E6',
  lineSoft: '#EEF3F2',
  lineStrong: '#C9DAD7',
  ink: '#062326',
  muted: '#4F6B6E',
  faint: '#6B8285',
  chip: '#DDF3EF',
  chipInk: '#0B6E74',
  // states
  success: '#1D7A3E',
  successBg: '#E3F5E8',
  successDot: '#22A055',
  danger: '#B42318',
  dangerBg: '#FDECEA',
  dangerDot: '#DC3B2B',
  warning: '#A4500F',
  warningBg: '#FFF1E2',
  violet: '#5B3DB5',
  violetBg: '#EEE8FB',
  violetLight: '#C9B7FF',
  blue: '#3A4FB5',
  blueBg: '#E8EEFF',
  pink: '#A12A5A',
  pinkBg: '#FDE7EE',
} as const

export const brandGradient = [C.tealLight, C.teal, C.green] as const
export const tealGradient = [C.teal, '#0E8F96', C.deep2] as const

export const F = {
  light: 'ReadexPro_300Light',
  regular: 'ReadexPro_400Regular',
  medium: 'ReadexPro_500Medium',
  semibold: 'ReadexPro_600SemiBold',
  bold: 'ReadexPro_700Bold',
} as const

export type Weight = keyof typeof F

export const R = { sm: 12, md: 16, lg: 20, xl: 24, xxl: 28, pill: 999 } as const

export const shadow = {
  card: { shadowColor: '#04282C', shadowOpacity: 0.1, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 4 },
  glow: { shadowColor: C.teal, shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 14 }, elevation: 8 },
} as const

/** Avatar gradients, picked by a stable hash of the name. */
export const AVATARS: [string, string][] = [
  ['#F6C177', '#E0823C'],
  ['#9FB4FF', '#5B6FD6'],
  ['#8BE07A', '#2F9E59'],
  ['#F7A8C4', '#C2477A'],
  ['#5FE3EA', '#0E8F96'],
  ['#C9B7FF', '#7B5BE0'],
  ['#FFD58A', '#C98A12'],
]

export function avatarFor(key: string): [string, string] {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return AVATARS[h % AVATARS.length]
}
