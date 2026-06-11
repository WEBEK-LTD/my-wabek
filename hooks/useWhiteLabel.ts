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

  return {
    brandName:           settings.brand_name || null,
    brandColor:          settings.brand_color || '#25D366',
    brandLogo:           settings.brand_logo || 'https://res.cloudinary.com/dkl7ntpgw/image/upload/f_auto,q_auto/%D8%AA%D8%B5%D9%85%D9%8A%D9%85_%D8%A8%D8%AF%D9%88%D9%86_%D8%B9%D9%86%D9%88%D8%A7%D9%86_1_kejdrs',
    brandSecondaryColor: settings.brand_secondary_color || '#0D1117',
    favIcon:             settings.favicon_url || null,
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
