import React, { createContext, useCallback, useContext, useRef, useState } from 'react'
import {
  ActivityIndicator, Animated, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type PressableProps, type StyleProp, type TextInputProps, type TextProps, type TextStyle, type ViewStyle,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { C, F, R, shadow, avatarFor, brandGradient, tealGradient, type Weight } from '@/lib/theme'
import { Icon, type IconName } from './Icon'
import { useI18n } from '@/i18n'

// ── Text ─────────────────────────────────────────────────────────────────────

export function T({ w = 'regular', size = 15, color = C.ink, style, ...rest }: TextProps & { w?: Weight; size?: number; color?: string }) {
  return <Text {...rest} style={[{ fontFamily: F[w], fontSize: size, color, lineHeight: Math.round(size * 1.55) }, style]} />
}

/** Numbers, phones, emails, codes: always left-to-right, even inside Arabic. */
export function Ltr({ style, ...rest }: React.ComponentProps<typeof T>) {
  return <T {...rest} style={[{ writingDirection: 'ltr' }, style]} />
}

// ── Buttons ──────────────────────────────────────────────────────────────────

type BtnVariant = 'brand' | 'teal' | 'outline' | 'ghost' | 'danger' | 'dangerText' | 'dark' | 'glass'

export function Btn({
  title, onPress, variant = 'brand', icon, loading, disabled, style, size = 'lg', accessibilityLabel,
}: { title: string; onPress?: () => void; variant?: BtnVariant; icon?: IconName; loading?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>; size?: 'lg' | 'md' | 'sm'; accessibilityLabel?: string }) {
  const h = size === 'lg' ? 56 : size === 'md' ? 48 : 38
  const fg =
    variant === 'brand' ? C.deep : variant === 'teal' || variant === 'danger' || variant === 'dark' ? '#FFFFFF'
      : variant === 'glass' ? C.onDeep : variant === 'ghost' ? C.chipInk : variant === 'dangerText' ? C.danger : C.ink
  const inner = (
    <View style={[styles.btnInner, { height: h }]}>
      {loading ? <ActivityIndicator color={fg} /> : (
        <>
          {icon ? <Icon name={icon} size={size === 'sm' ? 16 : 19} color={fg} /> : null}
          <T w="bold" size={size === 'sm' ? 13 : 16} color={fg}>{title}</T>
        </>
      )}
    </View>
  )
  const base: ViewStyle = { borderRadius: size === 'sm' ? 12 : 18, overflow: 'hidden', opacity: disabled ? 0.5 : 1 }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: !!disabled || !!loading, busy: !!loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [base, variant === 'brand' || variant === 'teal' ? shadow.glow : null, pressed && { transform: [{ scale: 0.98 }] }, style]}
    >
      {variant === 'brand' || variant === 'teal' ? (
        <LinearGradient colors={variant === 'brand' ? brandGradient : tealGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>{inner}</LinearGradient>
      ) : (
        <View
          style={{
            backgroundColor:
              variant === 'danger' ? C.dangerDot : variant === 'dark' ? C.deep : variant === 'glass' ? C.glass
                : variant === 'ghost' || variant === 'dangerText' ? 'transparent' : C.surface,
            borderWidth: variant === 'outline' ? 1.5 : variant === 'glass' ? 1 : 0,
            borderColor: variant === 'glass' ? C.glassBorder : C.lineStrong,
            borderRadius: size === 'sm' ? 12 : 18,
          }}
        >
          {inner}
        </View>
      )}
    </Pressable>
  )
}

export function IconBtn({ name, onPress, label, tone = 'light', size = 44, badge }: { name: IconName; onPress?: () => void; label: string; tone?: 'light' | 'dark' | 'teal'; size?: number; badge?: boolean }) {
  const bg = tone === 'dark' ? C.glass : tone === 'teal' ? C.teal : C.surface
  const border = tone === 'dark' ? C.glassBorder : tone === 'teal' ? C.teal : C.line
  const color = tone === 'light' ? C.ink : '#FFFFFF'
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [{ width: size, height: size, borderRadius: 14, backgroundColor: bg, borderWidth: 1, borderColor: border, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 }]}
    >
      <Icon name={name} size={20} color={tone === 'dark' ? C.onDeep : color} />
      {badge ? <View style={{ position: 'absolute', top: 9, end: 10, width: 9, height: 9, borderRadius: 5, backgroundColor: C.green, borderWidth: 2, borderColor: C.deep }} /> : null}
    </Pressable>
  )
}

// ── Inputs ───────────────────────────────────────────────────────────────────

export function Field({
  label, icon, error, hint, secure, ltr, style, dark, ...rest
}: TextInputProps & { label: string; icon?: IconName; error?: string | null; hint?: string; secure?: boolean; ltr?: boolean; dark?: boolean }) {
  const { t, isRTL } = useI18n()
  const [show, setShow] = useState(false)
  const [focus, setFocus] = useState(false)
  return (
    <View style={{ gap: 6 }}>
      <T w="semibold" size={13} color={dark ? C.onDeep : C.ink}>{label}</T>
      <View
        style={[
          styles.field,
          rest.multiline && { height: undefined, minHeight: 52, alignItems: 'flex-start', paddingVertical: 2 },
          dark && { backgroundColor: C.glass, borderColor: C.glassBorder },
          focus && { borderColor: C.teal },
          !!error && { borderColor: C.dangerDot },
        ]}
      >
        {icon ? <Icon name={icon} size={19} color={dark ? C.onDeepMuted : C.muted} /> : null}
        <TextInput
          placeholderTextColor={dark ? C.onDeepFaint : '#8AA0A2'}
          secureTextEntry={secure && !show}
          onFocus={e => { setFocus(true); rest.onFocus?.(e) }}
          onBlur={e => { setFocus(false); rest.onBlur?.(e) }}
          accessibilityLabel={label}
          {...rest}
          style={[
            styles.input,
            { color: dark ? C.onDeep : C.ink, writingDirection: ltr ? 'ltr' : isRTL ? 'rtl' : 'ltr' },
            // Native inputs follow the layout direction; the web preview needs it spelled out.
            Platform.OS === 'web' ? { textAlign: isRTL ? 'right' : 'left' } : null,
            style as StyleProp<TextStyle>,
          ]}
        />
        {secure ? (
          <Pressable accessibilityRole="button" accessibilityLabel={show ? t('hide_password') : t('show_password')} onPress={() => setShow(s => !s)} hitSlop={10}>
            <Icon name={show ? 'eyeOff' : 'eye'} size={20} color={C.muted} />
          </Pressable>
        ) : null}
      </View>
      {error ? <T size={12.5} color={C.danger}>{error}</T> : hint ? <T size={12} color={dark ? C.onDeepFaint : C.muted}>{hint}</T> : null}
    </View>
  )
}

// ── Surfaces ─────────────────────────────────────────────────────────────────

export function Card({ children, style, padded = true }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  return <View style={[styles.card, padded && { padding: 16 }, style]}>{children}</View>
}

export function DeepBg({ children, style, rounded }: { children?: React.ReactNode; style?: StyleProp<ViewStyle>; rounded?: boolean }) {
  return (
    <View style={[{ backgroundColor: C.deep, overflow: 'hidden' }, rounded && { borderBottomLeftRadius: 36, borderBottomRightRadius: 36 }, style]}>
      <LinearGradient colors={['rgba(14,108,114,0.95)', 'rgba(14,108,114,0)']} start={{ x: 1, y: 0 }} end={{ x: 0.3, y: 0.8 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={['rgba(29,107,74,0)', 'rgba(29,107,74,0.7)']} start={{ x: 0.6, y: 0.3 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
      {children}
    </View>
  )
}

export function Badge({ label, tone = 'neutral', dot }: { label: string; tone?: 'neutral' | 'success' | 'danger' | 'warning' | 'brand' | 'violet' | 'dark'; dot?: boolean }) {
  const map = {
    neutral: [C.lineSoft, C.muted],
    success: [C.successBg, C.success],
    danger: [C.dangerBg, C.danger],
    warning: [C.warningBg, C.warning],
    brand: [C.chip, C.chipInk],
    violet: [C.violetBg, C.violet],
    dark: ['rgba(234,247,245,0.1)', C.onDeep],
  } as const
  const [bg, fg] = map[tone]
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: bg, borderRadius: R.pill, paddingHorizontal: 9, height: 24 }}>
      {dot ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: fg }} /> : null}
      <T w="semibold" size={11.5} color={fg} style={{ lineHeight: 16 }}>{label}</T>
    </View>
  )
}

export function Avatar({ name, size = 46, square }: { name: string; size?: number; square?: boolean }) {
  const [a, b] = avatarFor(name || '?')
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?'
  return (
    <LinearGradient colors={[a, b]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size, height: size, borderRadius: square ? size * 0.32 : size / 2, alignItems: 'center', justifyContent: 'center' }}>
      <T w="semibold" size={size * 0.38} color="#0B1F22" style={{ lineHeight: size * 0.5 }}>{initial}</T>
    </LinearGradient>
  )
}

export function Divider({ dark }: { dark?: boolean }) {
  return <View style={{ height: 1, backgroundColor: dark ? 'rgba(234,247,245,0.08)' : C.lineSoft }} />
}

export function SectionTitle({ children, dark, action }: { children: string; dark?: boolean; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 20, marginBottom: 8, paddingHorizontal: 6 }}>
      <T w="semibold" size={13} color={dark ? C.onDeepMuted : C.muted} accessibilityRole="header">{children}</T>
      {action ? (
        <Pressable accessibilityRole="link" onPress={action.onPress} hitSlop={8}>
          <T w="semibold" size={13} color={C.chipInk}>{action.label}</T>
        </Pressable>
      ) : null}
    </View>
  )
}

export function ListRow({
  icon, iconBg = C.chip, iconColor = C.chipInk, title, subtitle, value, onPress, right, last, danger, dark,
}: { icon?: IconName; iconBg?: string; iconColor?: string; title: string; subtitle?: string; value?: string; onPress?: () => void; right?: React.ReactNode; last?: boolean; danger?: boolean; dark?: boolean }) {
  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: dark ? 'rgba(234,247,245,0.07)' : C.lineSoft }}>
      {icon ? (
        <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: iconBg, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={18} color={iconColor} />
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <T size={14.5} color={danger ? C.danger : dark ? C.onDeep : C.ink} numberOfLines={1}>{title}</T>
        {subtitle ? <T size={12} color={dark ? C.onDeepMuted : C.muted} numberOfLines={2}>{subtitle}</T> : null}
      </View>
      {value ? <T size={13} color={dark ? C.onDeepMuted : C.muted}>{value}</T> : null}
      {right}
      {onPress && !right ? <Icon name="chevron" size={16} color="#9BB0B2" stroke={2.2} /> : null}
    </View>
  )
  if (!onPress) return content
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => pressed && { backgroundColor: dark ? 'rgba(234,247,245,0.04)' : C.surface2 }}>
      {content}
    </Pressable>
  )
}

export function Toggle({ value, onChange, label, disabled }: { value: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      style={{ width: 50, height: 30, borderRadius: 15, padding: 3, backgroundColor: value ? C.teal : C.lineStrong, alignItems: value ? 'flex-end' : 'flex-start', opacity: disabled ? 0.5 : 1 }}
    >
      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF', ...shadow.card }} />
    </Pressable>
  )
}

export function Segmented<K extends string>({ items, value, onChange, dark }: { items: { key: K; label: string; badge?: string }[]; value: K; onChange: (k: K) => void; dark?: boolean }) {
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 4, padding: 4, borderRadius: 16, backgroundColor: dark ? 'rgba(234,247,245,0.07)' : C.lineSoft, borderWidth: dark ? 1 : 0, borderColor: 'rgba(234,247,245,0.1)' }}>
      {items.map(it => {
        const on = it.key === value
        const label = (
          <View style={{ height: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 6 }}>
            <T w={on ? 'semibold' : 'medium'} size={12.5} color={on ? (dark ? C.deep : C.onDeep) : dark ? C.onDeepMuted : C.muted} numberOfLines={1}>{it.label}</T>
            {it.badge ? (
              <View style={{ minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: on ? C.deep : C.dangerDot, alignItems: 'center', justifyContent: 'center' }}>
                <T w="bold" size={10.5} color={on ? C.green : '#FFFFFF'} style={{ lineHeight: 14 }}>{it.badge}</T>
              </View>
            ) : null}
          </View>
        )
        return (
          <Pressable key={it.key} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => onChange(it.key)} style={{ flex: 1, borderRadius: 12, overflow: 'hidden' }}>
            {on && dark ? (
              <LinearGradient colors={[C.tealLight, C.green]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>{label}</LinearGradient>
            ) : (
              <View style={{ backgroundColor: on ? C.deep : 'transparent' }}>{label}</View>
            )}
          </Pressable>
        )
      })}
    </View>
  )
}

export function Chips<K extends string>({ items, value, onChange }: { items: { key: K; label: string; count?: number }[]; value: K; onChange: (k: K) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 18 }}>
      {items.map(it => {
        const on = it.key === value
        return (
          <Pressable
            key={it.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(it.key)}
            style={{ height: 36, paddingHorizontal: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: on ? C.deep : C.surface, borderWidth: on ? 0 : 1, borderColor: C.line }}
          >
            <T w={on ? 'semibold' : 'medium'} size={13} color={on ? C.onDeep : C.muted}>{it.label}</T>
            {it.count ? (
              <View style={{ paddingHorizontal: 7, borderRadius: 99, backgroundColor: on ? C.green : C.lineSoft }}>
                <T w="semibold" size={11} color={on ? C.deep : C.muted}>{String(it.count)}</T>
              </View>
            ) : null}
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

// ── Screen scaffolding ───────────────────────────────────────────────────────

export function Screen({ children, bg = C.bg, edges = ['top'] }: { children: React.ReactNode; bg?: string; edges?: ('top' | 'bottom')[] }) {
  return <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: bg }}>{children}</SafeAreaView>
}

export function TopBar({ title, onBack, right, dark, subtitle }: { title: string; onBack?: (() => void) | false; right?: React.ReactNode; dark?: boolean; subtitle?: string }) {
  const { t } = useI18n()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 10 }}>
      {onBack !== false ? (
        <IconBtn name="back" label={t('back')} tone={dark ? 'dark' : 'light'} size={40} onPress={onBack || (() => (router.canGoBack() ? router.back() : router.replace('/home')))} />
      ) : null}
      <View style={{ flex: 1 }}>
        <T w="bold" size={20} color={dark ? C.onDeep : C.ink} accessibilityRole="header" numberOfLines={1}>{title}</T>
        {subtitle ? <T size={12} color={dark ? C.onDeepMuted : C.muted} numberOfLines={1}>{subtitle}</T> : null}
      </View>
      {right}
    </View>
  )
}

export function Loader({ dark }: { dark?: boolean }) {
  const { t } = useI18n()
  return (
    <View accessibilityLabel={t('loading')} style={{ paddingVertical: 48, alignItems: 'center' }}>
      <ActivityIndicator color={dark ? C.green : C.teal} />
    </View>
  )
}

export function Empty({ icon = 'chat', title, subtitle, action, dark }: { icon?: IconName; title: string; subtitle?: string; action?: { label: string; onPress: () => void }; dark?: boolean }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 28, gap: 10 }}>
      <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: dark ? 'rgba(234,247,245,0.08)' : C.chip, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={24} color={dark ? C.green : C.chipInk} />
      </View>
      <T w="semibold" size={16} color={dark ? C.onDeep : C.ink} style={{ textAlign: 'center' }}>{title}</T>
      {subtitle ? <T size={13.5} color={dark ? C.onDeepMuted : C.muted} style={{ textAlign: 'center' }}>{subtitle}</T> : null}
      {action ? <Btn title={action.label} onPress={action.onPress} variant="teal" size="md" style={{ marginTop: 6, minWidth: 180 }} /> : null}
    </View>
  )
}

export function ErrorView({ message, onRetry, dark }: { message: string; onRetry?: () => void; dark?: boolean }) {
  const { t } = useI18n()
  return <Empty icon="alert" title={message} action={onRetry ? { label: t('retry'), onPress: onRetry } : undefined} dark={dark} />
}

// ── Toast ────────────────────────────────────────────────────────────────────

const ToastCtx = createContext<(msg: string, tone?: 'ok' | 'error') => void>(() => {})

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null)
  const anim = useRef(new Animated.Value(0)).current
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const insets = useSafeAreaInsets()
  const show = useCallback((text: string, tone: 'ok' | 'error' = 'ok') => {
    if (timer.current) clearTimeout(timer.current)
    setMsg({ text, tone })
    Animated.spring(anim, { toValue: 1, useNativeDriver: Platform.OS !== 'web' }).start()
    timer.current = setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: Platform.OS !== 'web' }).start(() => setMsg(null))
    }, 2800)
  }, [anim])
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg ? (
        <Animated.View
          accessibilityLiveRegion="polite"
          pointerEvents="none"
          style={{
            position: 'absolute', left: 16, right: 16, top: insets.top + 10,
            opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 18, backgroundColor: msg.tone === 'ok' ? C.deep : C.dangerDot, ...shadow.card }}>
            <Icon name={msg.tone === 'ok' ? 'check' : 'alert'} size={18} color={msg.tone === 'ok' ? C.green : '#FFFFFF'} />
            <T w="medium" size={14} color="#FFFFFF" style={{ flex: 1 }}>{msg.text}</T>
          </View>
        </Animated.View>
      ) : null}
    </ToastCtx.Provider>
  )
}

export const useToast = () => useContext(ToastCtx)

export function GradientText({ children, size, style }: { children: string; size: number; style?: StyleProp<TextStyle> }) {
  // Gradient-filled text needs masked views; the brand's light teal is a close, readable stand-in.
  return <T w="bold" size={size} color={C.tealLight} style={style}>{children}</T>
}

const styles = StyleSheet.create({
  btnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 18 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 52, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1.5, borderColor: C.lineStrong, backgroundColor: C.surface2 },
  input: { flex: 1, height: '100%', fontFamily: F.regular, fontSize: 15, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null) },
  card: { backgroundColor: C.surface, borderRadius: R.xl, borderWidth: 1, borderColor: C.line },
})
