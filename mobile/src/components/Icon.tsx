import React from 'react'
import Svg, { Path, Circle, Rect } from 'react-native-svg'
import { useI18n } from '@/i18n'

// Stroke icons (24×24). Directional ones (`flip`) mirror in Arabic.
const P: Record<string, { d?: string[]; circles?: [number, number, number][]; rects?: [number, number, number, number, number][]; flip?: boolean }> = {
  home: { d: ['M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z'] },
  chat: { d: ['M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z'] },
  chart: { d: ['M4 20V10M10 20V4M16 20v-7M22 20H2'] },
  phone: { rects: [[6, 2, 12, 20, 3]], d: ['M11 18h2'] },
  user: { circles: [[12, 8, 4]], d: ['M4 21c0-4 3.6-6 8-6s8 2 8 6'] },
  users: { circles: [[9, 8, 4]], d: ['M2 21c0-4 3-6 7-6s7 2 7 6M17 11a3 3 0 1 0 0-6M22 21c0-3-2-5-5-5.5'] },
  bell: { d: ['M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z', 'M10 20a2 2 0 0 0 4 0'] },
  search: { circles: [[11, 11, 7]], d: ['M20 20l-3.5-3.5'] },
  plus: { d: ['M12 5v14M5 12h14'] },
  back: { d: ['M15 6l-6 6 6 6'], flip: true },
  chevron: { d: ['M9 6l6 6-6 6'], flip: true },
  forward: { d: ['M5 12h14M13 6l6 6-6 6'], flip: true },
  send: { d: ['M4 12l16-8-6 16-2.5-6.5z'], flip: true },
  attach: { d: ['M21 11.5l-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l8.6-8.6a3.7 3.7 0 0 1 5.2 5.2l-8.6 8.6a1.8 1.8 0 0 1-2.6-2.6l7.9-7.9'] },
  sparkle: { d: ['M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z'] },
  template: { rects: [[4, 3, 16, 18, 3]], d: ['M8 8h8M8 12h8M8 16h5'] },
  more: { circles: [[12, 5, 1.5], [12, 12, 1.5], [12, 19, 1.5]] },
  check: { d: ['M5 12.5l4.2 4.2L19 7'] },
  close: { d: ['M6 6l12 12M18 6L6 18'] },
  lock: { rects: [[4, 10, 16, 11, 3]], d: ['M8 10V7a4 4 0 0 1 8 0v3'] },
  mail: { rects: [[3, 5, 18, 14, 3]], d: ['M4 7l8 6 8-6'] },
  eye: { circles: [[12, 12, 3]], d: ['M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z'] },
  eyeOff: { d: ['M3 3l18 18', 'M10.6 5.1A9.9 9.9 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7c1.6 0 3-.4 4.3-1', 'M9.9 9.9a3 3 0 0 0 4.2 4.2'] },
  face: { d: ['M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2', 'M9 9v1.5M15 9v1.5M12 9v4h-1M9.5 16c1.4 1 3.6 1 5 0'] },
  shield: { d: ['M12 3l8 3v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6z'] },
  shieldCheck: { d: ['M12 3l8 3v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6z', 'M9 12l2 2 4-4'] },
  link: { d: ['M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1'] },
  unlink: { d: ['M9 15l6-6M10 6.5l1.4-1.4a4.5 4.5 0 0 1 6.4 6.4L16.5 13M13.5 17.5l-1.4 1.4a4.5 4.5 0 0 1-6.4-6.4L7 11', 'M3 3l18 18'] },
  qr: { rects: [[3, 3, 7, 7, 1.5], [14, 3, 7, 7, 1.5], [3, 14, 7, 7, 1.5]], d: ['M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3'] },
  cloud: { d: ['M7 18a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 8.5a4.5 4.5 0 0 1-.5 9.5z'] },
  copy: { rects: [[8, 8, 12, 12, 2]], d: ['M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2'] },
  bolt: { d: ['M13 2L4 14h7l-1 8 9-12h-7l1-8z'] },
  userPlus: { circles: [[9, 8, 4]], d: ['M2 21c0-4 3-6 7-6s7 2 7 6M19 8v6M16 11h6'] },
  headset: { d: ['M4 13v-1a8 8 0 0 1 16 0v1', 'M19.5 19c0 1.5-2 2.5-5 2.5'], rects: [[2.5, 13, 4, 6, 1.5], [17.5, 13, 4, 6, 1.5]] },
  globe: { circles: [[12, 12, 9]], d: ['M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z'] },
  building: { d: ['M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6'] },
  key: { circles: [[8, 15, 4]], d: ['M10.8 12.2L20 3M16 7l3 3M18 5l2 2'] },
  devices: { rects: [[7, 2, 10, 20, 2]], d: ['M11 18h2'] },
  book: { d: ['M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2z', 'M8 7h6M8 11h6'] },
  doc: { d: ['M6 3h9l5 5v13H6z', 'M14 3v6h6M9 13h7M9 17h7'] },
  logout: { d: ['M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11'], flip: true },
  trash: { d: ['M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3'] },
  download: { d: ['M12 3v12M7 10l5 5 5-5M5 21h14'] },
  trend: { d: ['M3 17l6-6 4 4 8-8', 'M15 7h6v6'] },
  star: { d: ['M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z'] },
  image: { rects: [[3, 4, 18, 16, 3]], circles: [[9, 10, 2]], d: ['M21 16l-5-5-9 9'] },
  refresh: { d: ['M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7'] },
  whatsapp: { d: ['M3.5 20.5l1.3-4.6A8.5 8.5 0 1 1 8 19.2z', 'M9 8.5c.3 2.6 2.9 5.2 5.5 5.5l1.2-1.2 2 .8-.5 1.9c-4.6.4-9-4-8.6-8.6l1.9-.5.8 2z'] },
  sun: { circles: [[12, 12, 4]], d: ['M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4'] },
  alert: { d: ['M12 3l10 18H2z', 'M12 10v4M12 17v.01'] },
  clock: { circles: [[12, 12, 9]], d: ['M12 7v5l3 2'] },
}

export type IconName = keyof typeof P

export function Icon({ name, size = 20, color = '#062326', stroke = 2, noFlip }: { name: IconName; size?: number; color?: string; stroke?: number; noFlip?: boolean }) {
  const { isRTL } = useI18n()
  const def = P[name]
  const flip = !noFlip && def.flip && isRTL
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={flip ? { transform: [{ scaleX: -1 }] } : undefined}>
      {(def.d || []).map((d, i) => (
        <Path key={`p${i}`} d={d} stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {(def.circles || []).map(([cx, cy, r], i) => (
        <Circle key={`c${i}`} cx={cx} cy={cy} r={r} stroke={color} strokeWidth={stroke} fill={r <= 1.5 ? color : 'none'} />
      ))}
      {(def.rects || []).map(([x, y, w, h, rx], i) => (
        <Rect key={`r${i}`} x={x} y={y} width={w} height={h} rx={rx} stroke={color} strokeWidth={stroke} />
      ))}
    </Svg>
  )
}

/** Read-receipt ticks for outgoing messages. */
export function Ticks({ status, color }: { status: string; color: string }) {
  if (status === 'failed') return <Icon name="alert" size={13} color="#F6A196" />
  const double = status === 'delivered' || status === 'read'
  const c = status === 'read' ? '#8BE07A' : color
  return (
    <Svg width={18} height={12} viewBox="0 0 18 12" fill="none">
      <Path d="M1 6.5l3.2 3.2L10.5 3" stroke={c} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
      {double ? <Path d="M7.5 9.7L14 3" stroke={c} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" /> : null}
    </Svg>
  )
}
