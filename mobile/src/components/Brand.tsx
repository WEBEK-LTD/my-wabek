import React from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import { Image } from 'expo-image'
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg'

const LOGO = require('../../assets/brand/logo.png')

/**
 * The WABEK mark on its own — no box around it. A soft round glow in the
 * brand's teal sits behind it so the logo reads clearly on the dark screens.
 * (`ring` is kept for call-site compatibility; it only strengthens the glow.)
 */
export function LogoTile({ size = 96, ring = true, style }: { size?: number; ring?: boolean; style?: StyleProp<ViewStyle> }) {
  const glow = size * 1.5
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Svg width={glow} height={glow} style={{ position: 'absolute', left: (size - glow) / 2, top: (size - glow) / 2 }} pointerEvents="none">
        <Defs>
          <RadialGradient id="logoGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#5FE3EA" stopOpacity={ring ? 0.55 : 0.4} />
            <Stop offset="0.45" stopColor="#12B5BE" stopOpacity={ring ? 0.28 : 0.18} />
            <Stop offset="1" stopColor="#12B5BE" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={glow / 2} cy={glow / 2} r={glow / 2} fill="url(#logoGlow)" />
      </Svg>
      <Image source={LOGO} style={{ width: size, height: size }} contentFit="contain" accessibilityLabel="WABEK" />
    </View>
  )
}
