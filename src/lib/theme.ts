export type ThemeChoice = 'light' | 'dark'

const STORAGE_KEY = 'moments-theme'

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** What the user explicitly chose, if anything — otherwise falls back to the OS setting. */
export function getStoredTheme(): ThemeChoice | null {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' ? stored : null
}

export function resolveInitialTheme(): ThemeChoice {
  return getStoredTheme() ?? (systemPrefersDark() ? 'dark' : 'light')
}

export function applyTheme(theme: ThemeChoice): void {
  document.documentElement.setAttribute('data-theme', theme)
}

export function persistTheme(theme: ThemeChoice): void {
  localStorage.setItem(STORAGE_KEY, theme)
}
