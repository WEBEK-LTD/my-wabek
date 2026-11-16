// Client-side push notification helper

export async function subscribeToPush(vapidPublicKey: string): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push not supported in this browser')
      return false
    }

    // Request notification permission
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return false

    // Get or register service worker
    const registration = await navigator.serviceWorker.ready

    // Convert VAPID key — cast to ArrayBuffer to satisfy DOM typings
    const appServerKey = urlBase64ToUint8Array(vapidPublicKey)
    const appServerKeyBuffer = appServerKey.buffer as ArrayBuffer

    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription()

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: appServerKeyBuffer,
      })
    }

    // Send subscription to server
    // Authenticated by the HttpOnly session cookie (same origin).
    await fetch('/api/push/subscribe', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription }),
    })

    return true
  } catch (e) {
    console.error('Push subscription failed:', e)
    return false
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (subscription) {
      await subscription.unsubscribe()
      await fetch('/api/push/subscribe', { method: 'DELETE', credentials: 'same-origin' })
    }
    return true
  } catch { return false }
}

export async function getPushStatus(): Promise<'granted' | 'denied' | 'default' | 'unsupported'> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported'
  return Notification.permission as 'granted' | 'denied' | 'default'
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
