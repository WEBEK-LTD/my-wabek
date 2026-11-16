import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'

// Secrets (the session token) live in the Keychain / Keystore. On the web
// build (used for previews only) SecureStore is unavailable, so localStorage
// is used there.
const web = Platform.OS === 'web'

function ls(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

export async function getItem(key: string): Promise<string | null> {
  if (web) return ls()?.getItem(key) ?? null
  try {
    return await SecureStore.getItemAsync(key)
  } catch {
    return null
  }
}

export async function setItem(key: string, value: string): Promise<void> {
  if (web) {
    ls()?.setItem(key, value)
    return
  }
  try {
    await SecureStore.setItemAsync(key, value)
  } catch {
    /* the device refused to store it — the app keeps working for this session */
  }
}

export async function removeItem(key: string): Promise<void> {
  if (web) {
    ls()?.removeItem(key)
    return
  }
  try {
    await SecureStore.deleteItemAsync(key)
  } catch {
    /* nothing stored */
  }
}

export const KEYS = {
  token: 'wabek_token',
  tokenAt: 'wabek_token_at',
  lang: 'wabek_lang',
  lock: 'wabek_lock',
  pushToken: 'wabek_push_token',
  onboarded: 'wabek_onboarded',
} as const
