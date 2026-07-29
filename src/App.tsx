import { useCallback, useState } from 'react'
import { Editor } from './components/Editor'
import { MyBooks } from './components/MyBooks'
import { applyTheme, persistTheme, resolveInitialTheme, type ThemeChoice } from './lib/theme'

type View = { kind: 'library' } | { kind: 'editor'; projectId: string }

export default function App() {
  const [view, setView] = useState<View>({ kind: 'library' })
  const [theme, setTheme] = useState<ThemeChoice>(() => resolveInitialTheme())

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark'
      applyTheme(next)
      persistTheme(next)
      return next
    })
  }, [])

  if (view.kind === 'editor') {
    return (
      <Editor
        projectId={view.projectId}
        onGoToLibrary={() => setView({ kind: 'library' })}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    )
  }

  return <MyBooks onOpenBook={(projectId) => setView({ kind: 'editor', projectId })} />
}
