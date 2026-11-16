import React from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { C } from '@/lib/theme'

const LOGO = require('../../assets/brand/logo.png')

/**
 * The WABEK mark on a white tile with the brand gradient ring — the way the
 * app icon looks on a phone, so the teal/green logo always reads clearly.
 */
export function LogoTile({ size = 96, ring = true, style }: { size?: number; ring?: boolean; style?: StyleProp<ViewStyle> }) {
  const radius = size * 0.28
  const tile = (
    <LinearGradient
      colors={['#FFFFFF', '#F2FBF9', '#E3F5F1']}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={{ flex: 1, borderRadius: ring ? radius - 2 : radius, alignItems: 'center', justifyContent: 'center' }}
    >
      <Image source={LOGO} style={{ width: size * 0.75, height: size * 0.75 }} contentFit="contain" accessibilityLabel="WABEK" />
    </LinearGradient>
  )
  if (!ring) {
    return <View style={[{ width: size, height: size, borderRadius: radius, overflow: 'hidden' }, style]}>{tile}</View>
  }
  return (
    <LinearGradient
      colors={[C.tealLight, C.teal, C.green]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[{ width: size, height: size, borderRadius: radius, padding: Math.max(2, size * 0.02) }, style]}
    >
      {tile}
    </LinearGradient>
  )
}
