import { Platform } from 'react-native'
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { api } from './api'
import { getItem, setItem, removeItem, KEYS } from './storage'

export type PushPrefs = { messages: boolean; numbers: boolean; campaigns: boolean }

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  })
}

function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined
  const id = extra?.eas?.projectId || (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId
  return id || undefined
}

async function currentLang(): Promise<'en' | 'ar'> {
  return (await getItem(KEYS.lang)) === 'ar' ? 'ar' : 'en'
}

/** Ask for permission (once), get the Expo push token and register it with WABEK. */
export async function registerPush(): Promise<'granted' | 'denied' | 'unavailable'> {
  if (Platform.OS === 'web' || !Device.isDevice) return 'unavailable'
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('messages', {
        name: 'Messages',
        importance: Notifications.AndroidImportance.HIGH,
        lightColor: '#12B5BE',
      })
      await Notifications.setNotificationChannelAsync('alerts', {
        name: 'Alerts',
        importance: Notifications.AndroidImportance.HIGH,
        lightColor: '#DC3B2B',
      })
    }
    let { status } = await Notifications.getPermissionsAsync()
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status
    if (status !== 'granted') return 'denied'
    const pid = projectId()
    if (!pid) return 'unavailable' // set expo.extra.eas.projectId (eas init) for push to work
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: pid })
    await api('/api/mobile/push-token', {
      method: 'POST',
      body: { token, platform: Platform.OS, locale: await currentLang() },
    })
    await setItem(KEYS.pushToken, token)
    return 'granted'
  } catch {
    return 'unavailable'
  }
}

export async function unregisterPush(): Promise<void> {
  const token = await getItem(KEYS.pushToken)
  if (!token) return
  try {
    await api('/api/mobile/push-token', { method: 'DELETE', body: { token } })
  } finally {
    await removeItem(KEYS.pushToken)
  }
}

/** Language or notification switches changed. */
export async function updatePush(patch: { locale?: 'en' | 'ar'; prefs?: Partial<PushPrefs> }): Promise<boolean> {
  const token = await getItem(KEYS.pushToken)
  if (!token) return false
  await api('/api/mobile/push-token', { method: 'PUT', body: { token, ...patch } })
  return true
}

export async function pushPermission(): Promise<'granted' | 'denied' | 'undetermined' | 'unavailable'> {
  if (Platform.OS === 'web') return 'unavailable'
  try {
    const { status } = await Notifications.getPermissionsAsync()
    return status as 'granted' | 'denied' | 'undetermined'
  } catch {
    return 'unavailable'
  }
}

/** Where a tapped notification should open (see lib/mobile-push.ts on the server). */
export function routeForNotification(data: Record<string, unknown> | undefined): string | null {
  const route = typeof data?.route === 'string' ? data.route : ''
  const ticket = typeof data?.ticket_id === 'string' ? data.ticket_id : ''
  switch (route) {
    case 'inbox': return '/inbox'
    case 'numbers': return '/numbers'
    case 'analytics': return '/analytics'
    case 'support': return ticket ? `/support/${ticket}` : '/support'
    case 'admin_support': return ticket ? `/admin/ticket/${ticket}` : '/admin'
    case 'admin_users': return '/admin'
    default: return null
  }
}
