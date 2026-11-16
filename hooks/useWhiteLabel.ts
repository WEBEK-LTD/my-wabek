import { useState, useEffect, useMemo } from 'react'
import { useQuery } from 'react-query'
import axios from 'axios'
import { useAuthStore } from '@/lib/store'

interface WhiteLabelSettings {
  brand_name?: string
  brand_logo?: string
  brand_color?: string
  brand_secondary_color?: string
  custom_domain?: string
  favicon_url?: string
  support_email?: string
  support_whatsapp?: string
  hide_powered_by?: boolean
  custom_css?: string
  custom_footer?: string
}

/** Official WABEK brand assets (the only logo). */
export const BRAND_ASSETS = {
  mark: '/brand/logo-mark.png',
  mark512: '/brand/logo-mark-512.png',
  favicon: '/brand/favicon-32.png',
  appleTouch: '/brand/apple-touch-icon.png',
  name: 'WABEK',
} as const

/**
 * The previous default logo lived on Cloudinary and is still stored in some
 * system settings rows. Treat it (and empty values) as "no override" so the
 * official /brand assets are used instead.
 */
export function isLegacyBrandAsset(url?: string | null): boolean {
  if (!url) return true
  return /res\.cloudinary\.com\/dkl7ntpgw\//.test(url)
}

/** Returns a tenant override URL, or null when the default brand should be used. */
export function brandOverride(url?: string | null): string | null {
  return isLegacyBrandAsset(url) ? null : (url as string)
}

const MAIN_DOMAINS = ['waabek.com', 'www.waabek.com', 'localhost', '127.0.0.1']

export function useWhiteLabel() {
  const user = useAuthStore(s => s.user)

  // Safe client-side domain detection
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const onMain = useMemo(() => {
    if (!mounted || typeof window === 'undefined') return true
    const host = window.location.hostname
    return MAIN_DOMAINS.some(d => host === d || host.endsWith('netlify.app'))
  }, [mounted])

  // For users on custom domain: fetch their WL settings
  const { data: userWL } = useQuery(
    'white-label',
    () => axios.get('/api/white-label').then(r => r.data),
    { enabled: !!user && mounted && !onMain, staleTime: 60000, retry: false }
  )

  // Always fetch domain-level brand settings
  const { data: domainWL } = useQuery(
    'white-label-public',
    () => {
      const host = window.location.hostname
      return axios.get(`/api/white-label/public?domain=${encodeURIComponent(host)}&_t=${Date.now()}`).then(r => r.data)
    },
    { enabled: mounted, staleTime: 300000, retry: false }
  )

  const settings: WhiteLabelSettings = useMemo(() => {
    if (onMain) return domainWL?.settings || {}
    return (user ? userWL?.settings : domainWL?.settings) || domainWL?.settings || {}
  }, [onMain, user, userWL, domainWL])

  const customLogo = brandOverride(settings.brand_logo)
  const customFavicon = brandOverride(settings.favicon_url)

  return {
    brandName:           settings.brand_name || null,
    brandColor:          settings.brand_color || '#12B5BE',
    /** Always a usable logo URL: tenant override or the official mark. */
    brandLogo:           customLogo || BRAND_ASSETS.mark,
    /** Tenant logo override only (null = use the official WABEK mark). */
    customLogo,
    brandSecondaryColor: settings.brand_secondary_color || '#04282C',
    favIcon:             customFavicon,
    hidePoweredBy:       settings.hide_powered_by || false,
    customCss:           settings.custom_css || null,
    customFooter:        settings.custom_footer || null,
    supportEmail:        settings.support_email || null,
    supportWhatsApp:     settings.support_whatsapp || null,
    isWhiteLabel:        !onMain && !!settings.brand_name,
    settings,
    wl: settings,
  }
}
