import React, { useEffect, useRef } from 'react'
import { Animated, Easing, Platform, type StyleProp, type ViewStyle } from 'react-native'

const native = Platform.OS !== 'web'

/** Gently floats its child up and down (and optionally tilts it). */
export function Floating({ children, distance = 10, duration = 3000, rotate = 0, delay = 0, style }: { children: React.ReactNode; distance?: number; duration?: number; rotate?: number; delay?: number; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration, delay, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
      Animated.timing(v, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
    ]))
    loop.start()
    return () => loop.stop()
  }, [v, duration, delay])
  return (
    <Animated.View
      style={[style, {
        transform: [
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -distance] }) },
          { rotate: v.interpolate({ inputRange: [0, 1], outputRange: [`${rotate}deg`, `${rotate * 0.7}deg`] }) },
        ],
      }]}
    >
      {children}
    </Animated.View>
  )
}

/** Fades and lifts in once, after `delay` ms. */
export function Rise({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 800, delay, easing: Easing.out(Easing.cubic), useNativeDriver: native }).start()
  }, [v, delay])
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }]}>
      {children}
    </Animated.View>
  )
}

/** Three "typing" dots. */
export function TypingDots({ color }: { color: string }) {
  const v = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: native }))
    loop.start()
    return () => loop.stop()
  }, [v])
  return (
    <Animated.View style={{ flexDirection: 'row', gap: 4 }}>
      {[0, 1, 2].map(i => (
        <Animated.View
          key={i}
          style={{
            width: 6, height: 6, borderRadius: 3, backgroundColor: color,
            opacity: v.interpolate({ inputRange: [0, (i + 0.5) / 4, (i + 1.5) / 4, 1], outputRange: [0.25, 1, 0.25, 0.25] }),
          }}
        />
      ))}
    </Animated.View>
  )
}

/** Pulsing dot (live / alert). */
export function PulseDot({ color, size = 8 }: { color: string; size?: number }) {
  const v = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 800, useNativeDriver: native }),
      Animated.timing(v, { toValue: 0, duration: 800, useNativeDriver: native }),
    ]))
    loop.start()
    return () => loop.stop()
  }, [v])
  return <Animated.View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity: v.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] }) }} />
}
