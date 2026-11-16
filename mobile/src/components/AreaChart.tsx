import React, { useEffect, useRef, useState } from 'react'
import { Animated, Easing, View } from 'react-native'
import Svg, { Defs, LinearGradient, Path, Stop, Circle } from 'react-native-svg'

const AnimatedPath = Animated.createAnimatedComponent(Path)

function smoothPath(pts: [number, number][]) {
  if (pts.length === 0) return ''
  if (pts.length === 1) return `M${pts[0][0]} ${pts[0][1]}`
  let d = `M${pts[0][0]} ${pts[0][1]}`
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]
    const [x1, y1] = pts[i]
    const cx = (x0 + x1) / 2
    d += ` C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`
  }
  return d
}

/** Two-series smooth area chart that draws itself in. Always left-to-right (time axis). */
export function AreaChart({ a, b, height = 130, colorA, colorB, label }: { a: number[]; b: number[]; height?: number; colorA: string; colorB: string; label: string }) {
  const [w, setW] = useState(0)
  const draw = useRef(new Animated.Value(0)).current
  const key = a.join(',') + '|' + b.join(',')
  useEffect(() => {
    draw.setValue(0)
    Animated.timing(draw, { toValue: 1, duration: 1600, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start()
  }, [key, draw])

  // Scale between the lowest and highest value (with headroom) so day-to-day changes are visible.
  const all = [...a, ...b]
  const hi = Math.max(1, ...all)
  const lo = all.length ? Math.min(...all) : 0
  const floor = Math.max(0, lo - (hi - lo) * 0.35 - hi * 0.05)
  const range = Math.max(1, hi - floor)
  const pad = 8
  const toPts = (vals: number[]): [number, number][] =>
    vals.map((v, i) => [vals.length === 1 ? w / 2 : (i / (vals.length - 1)) * w, pad + (height - pad * 2) * (1 - (v - floor) / range)])
  const pa = toPts(a)
  const pb = toPts(b)
  const la = smoothPath(pa)
  const lb = smoothPath(pb)
  const len = Math.max(1, w * 2.2)

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ height, direction: 'ltr' }} onLayout={e => setW(e.nativeEvent.layout.width)}>
      {w > 0 ? (
        <Svg width={w} height={height}>
          <Defs>
            <LinearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={colorA} stopOpacity={0.35} /><Stop offset="1" stopColor={colorA} stopOpacity={0} /></LinearGradient>
          </Defs>
          <Path d={`M0 ${height / 3}H${w}M0 ${(height * 2) / 3}H${w}`} stroke="rgba(234,247,245,0.07)" strokeWidth={1} />
          {la ? <Path d={`${la} L ${w} ${height} L 0 ${height} Z`} fill="url(#ga)" /> : null}
          {la ? <AnimatedPath d={la} fill="none" stroke={colorA} strokeWidth={2.6} strokeLinecap="round" strokeDasharray={`${len}`} strokeDashoffset={draw.interpolate({ inputRange: [0, 1], outputRange: [len, 0] })} /> : null}
          {lb ? <AnimatedPath d={lb} fill="none" stroke={colorB} strokeWidth={2.6} strokeLinecap="round" strokeDasharray={`${len}`} strokeDashoffset={draw.interpolate({ inputRange: [0, 1], outputRange: [len, 0] })} /> : null}
          {pa.length ? <Circle cx={pa[pa.length - 1][0]} cy={pa[pa.length - 1][1]} r={4.5} fill="#021A1D" stroke={colorA} strokeWidth={2.5} /> : null}
        </Svg>
      ) : null}
    </View>
  )
}
