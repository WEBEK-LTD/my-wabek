import React from 'react'
import { Toaster, ToasterProps } from 'react-hot-toast'

/**
 * Toast theme for react-hot-toast. Colours are CSS variables, so the same
 * options work in light and dark mode. Mounted once in pages/_app.tsx:
 *
 *   <AppToaster dir={dir} />
 *
 * Use toast as usual anywhere:  toast.success('تم حفظ الإعدادات')
 */
export const toastOptions: ToasterProps['toastOptions'] = {
  duration: 4000,
  style: {
    background: 'rgb(var(--surface))',
    color: 'rgb(var(--ink))',
    border: '1px solid rgb(var(--line))',
    borderRadius: '14px',
    padding: '10px 14px',
    fontSize: '14px',
    fontFamily: 'var(--font-sans)',
    lineHeight: '1.5',
    boxShadow: '0 18px 48px rgb(var(--shadow) / 0.16), 0 2px 6px rgb(var(--shadow) / 0.06)',
    maxWidth: '420px',
  },
  success: { iconTheme: { primary: '#12B5BE', secondary: '#FFFFFF' } },
  error: { iconTheme: { primary: '#BE283E', secondary: '#FFFFFF' }, duration: 6000 },
  loading: { iconTheme: { primary: '#12B5BE', secondary: 'rgba(18,181,190,0.2)' } },
}

export interface AppToasterProps {
  /** Page direction — toasts appear at the top end corner. */
  dir?: 'rtl' | 'ltr'
}

export function AppToaster({ dir = 'rtl' }: AppToasterProps) {
  return (
    <Toaster
      position={dir === 'rtl' ? 'top-left' : 'top-right'}
      gutter={10}
      containerStyle={{ top: 16, insetInline: 16, zIndex: 70 }}
      toastOptions={toastOptions}
    />
  )
}

export default AppToaster
