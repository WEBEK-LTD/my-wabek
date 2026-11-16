import { Platform } from 'react-native'
import * as Crypto from 'expo-crypto'
import { getItem, setItem } from './storage'

/** A stable per-install id so "trust this device" works across sign-ins. */
export async function deviceFingerprint(): Promise<string> {
  const k = 'wabek_device_id'
  let id = await getItem(k)
  if (!id) {
    id = Crypto.randomUUID().replace(/-/g, '').slice(0, 16)
    await setItem(k, id)
  }
  return `${Platform.OS}-${id}`
}

/** Credentials of the sign-in waiting for its code (memory only, never stored) — used to resend the code. */
export const pendingLogin: { email: string; password: string } = { email: '', password: '' }
