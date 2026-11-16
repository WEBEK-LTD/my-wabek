import { Platform } from 'react-native'
import * as LocalAuthentication from 'expo-local-authentication'
import { getItem, setItem, KEYS } from './storage'

/** Shared between the root layout (shows the lock screen) and the lock screen (clears it). */
export const lockGate = { active: false }

export type Biometric = { available: boolean; kind: 'face' | 'finger' }

export async function biometricInfo(): Promise<Biometric> {
  if (Platform.OS === 'web') return { available: false, kind: 'finger' }
  try {
    const hw = await LocalAuthentication.hasHardwareAsync()
    const enrolled = hw && (await LocalAuthentication.isEnrolledAsync())
    const types = hw ? await LocalAuthentication.supportedAuthenticationTypesAsync() : []
    const face = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
    return { available: !!enrolled, kind: face ? 'face' : 'finger' }
  } catch {
    return { available: false, kind: 'finger' }
  }
}

export async function authenticate(prompt: string, cancelLabel: string): Promise<boolean> {
  if (Platform.OS === 'web') return true
  try {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: prompt, cancelLabel })
    return r.success
  } catch {
    return false
  }
}

export async function isLockEnabled(): Promise<boolean> {
  return (await getItem(KEYS.lock)) === '1'
}

export async function setLockEnabled(on: boolean): Promise<void> {
  await setItem(KEYS.lock, on ? '1' : '0')
}
