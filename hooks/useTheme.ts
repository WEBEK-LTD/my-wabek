// Dark mode removed
export type Theme = 'dark'
export function useTheme() { return { theme: 'dark' as Theme, toggle: () => {}, isDark: true, isLight: false } }
