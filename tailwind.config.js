/** @type {import('tailwindcss').Config} */

// Lagoon design tokens. Every semantic colour is a CSS variable holding
// space-separated RGB channels (see styles/globals.css), so classes such as
// `bg-surface`, `text-ink/60` or `border-line` work in light and dark mode.
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`

module.exports = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './hooks/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── Semantic surfaces ──────────────────────────────
        canvas:      v('bg'),          // page background
        bg:          v('bg'),          // alias of canvas
        surface:     { DEFAULT: v('surface'), 2: v('surface-2'), 3: v('surface-3') },
        line:        { DEFAULT: v('line'), soft: v('line-soft'), strong: v('line-strong') },
        ink:         { DEFAULT: v('ink'), body: v('body'), muted: v('muted') },
        body:        v('body'),
        muted:       v('muted'),
        track:       v('track'),
        overlay:     v('overlay'),

        // ── Deep (sidebar / hero) ─────────────────────────
        deep:        { DEFAULT: v('deep'), 2: v('deep-2'), ink: v('on-deep'), muted: v('on-deep-muted') },

        // ── Brand ─────────────────────────────────────────
        link:        { DEFAULT: v('link'), hover: v('link-hover') },
        chip:        { DEFAULT: v('chip'), ink: v('chip-ink') },
        brand: {
          DEFAULT: v('brand-teal'),
          teal:    v('brand-teal'),
          green:   v('brand-green'),
          ink:     v('brand-ink'),
          // Legacy numeric scale (teal) kept so existing pages keep compiling.
          50:  '#ECFAF8',
          100: '#DDF3EF',
          200: '#B4E8E3',
          300: '#7FD8D3',
          400: '#3FC4C9',
          500: '#12B5BE',
          600: '#0B8A92',
          700: '#097A81',
          800: '#06666C',
          900: '#0E4F54',
          950: '#04282C',
        },

        // ── Status tones (text on tinted background) ──────
        success: { DEFAULT: v('success'), bg: v('success-bg') },
        warning: { DEFAULT: v('warning'), bg: v('warning-bg') },
        violet:  { DEFAULT: v('violet'),  bg: v('violet-bg') },
        danger:  { DEFAULT: v('danger'),  bg: v('danger-bg'), solid: v('danger-solid') },
        info:    { DEFAULT: v('chip-ink'), bg: v('chip') },

        // ── Legacy aliases (old pages) → mapped to tokens ─
        wabek: {
          dark:    v('bg'),
          card:    v('surface'),
          border:  v('line'),
          muted:   v('surface-2'),
          text:    v('muted'),
          surface: v('surface-2'),
        },
      },
      fontFamily: {
        sans:    ['var(--font-sans)'],
        display: ['var(--font-sans)'],
        mono:    ['var(--font-mono)'],
      },
      fontSize: {
        '2xs': ['11px', { lineHeight: '16px' }],
      },
      borderRadius: {
        card:  '20px',
        panel: '22px',
        hero:  '28px',
        field: '12px',
        btn:   '12px',
      },
      boxShadow: {
        card:       '0 1px 2px rgb(var(--shadow) / 0.04), 0 6px 18px rgb(var(--shadow) / 0.05)',
        'card-hover': '0 2px 4px rgb(var(--shadow) / 0.05), 0 14px 34px rgb(var(--shadow) / 0.09)',
        dropdown:   '0 18px 48px rgb(var(--shadow) / 0.16), 0 2px 6px rgb(var(--shadow) / 0.06)',
        hero:       '0 30px 70px rgba(4,40,44,0.18)',
        glow:       '0 16px 50px rgba(139,224,122,0.35)',
        ring:       '0 0 0 4px rgb(var(--brand-teal) / 0.18)',
      },
      backgroundImage: {
        'brand-gradient':   'linear-gradient(135deg, #12B5BE, #8BE07A)',
        'brand-gradient-x': 'linear-gradient(90deg, #12B5BE, #8BE07A)',
        'brand-gradient-soft': 'linear-gradient(120deg, #12B5BE, #8BE07A)',
        'deep-hero':  'radial-gradient(120% 60% at 100% 0%, #0E6C72, rgba(14,108,114,0) 70%)',
        'deep-panel': 'linear-gradient(150deg, #0E6C72, #04282C)',
      },
      spacing: {
        sidebar: '266px',
        topbar:  '56px',
      },
      maxWidth: {
        content: '1400px',
      },
      zIndex: {
        sidebar: '40',
        overlay: '50',
        modal:   '60',
        toast:   '70',
      },
      animation: {
        'fade-in':  'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        shimmer:    'shimmer 1.4s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:  { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { transform: 'translateY(8px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        shimmer: { '0%': { backgroundPosition: '200% 0' }, '100%': { backgroundPosition: '-200% 0' } },
      },
    },
  },
  plugins: [],
}
