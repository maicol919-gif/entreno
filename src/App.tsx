import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session as AuthSession } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { DataProvider } from './store'
import Login from './screens/Login'
import Today from './screens/Today'
import HistoryTab from './screens/History'
import Gym from './screens/Gym'
import SettingsTab from './screens/Settings'
import Progress from './screens/Progress'
import { RestProvider } from './rest'
import UpdateBanner from './UpdateBanner'
import PasswordRecovery from './screens/PasswordRecovery'

type Tab = 'today' | 'evolution' | 'gym' | 'settings'
type EvolutionView = 'progress' | 'history'

const TABS: [Tab, string, string][] = [
  ['today', 'Hoy', 'home'],
  ['evolution', 'Evolución', 'trend'],
  ['gym', 'Gimnasio', 'gym'],
  ['settings', 'Ajustes', 'settings'],
]

function TabIcon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
    trend: <><path d="M3 3v18h18" /><path d="m7 14 4-4 3 3 6-7" /><path d="M16 6h4v4" /></>,
    gym: <><path d="M6 7v10M3 9v6M18 7v10m3-8v6M6 12h12" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1a1.7 1.7 0 1 1-2.4 2.4L17 17.4a1.7 1.7 0 0 0-2.9 1.2v.2a1.7 1.7 0 1 1-3.4 0v-.2A1.7 1.7 0 0 0 7.8 17l-.1.1a1.7 1.7 0 1 1-2.4-2.4l.1-.1a1.7 1.7 0 0 0-1.2-2.9H4a1.7 1.7 0 1 1 0-3.4h.2A1.7 1.7 0 0 0 5.4 7l-.1-.1a1.7 1.7 0 1 1 2.4-2.4l.1.1a1.7 1.7 0 0 0 2.9-1.2v-.2a1.7 1.7 0 1 1 3.4 0v.2A1.7 1.7 0 0 0 17 4.6l.1-.1a1.7 1.7 0 1 1 2.4 2.4l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a1.7 1.7 0 1 1 0 3.4h-.2a1.7 1.7 0 0 0-1.2 1.7Z" /></>,
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

export default function App() {
  const [auth, setAuth] = useState<AuthSession | null | undefined>(undefined)
  const [recovering, setRecovering] = useState(false)
  const [tab, setTab] = useState<Tab>('today')
  const [evolutionView, setEvolutionView] = useState<EvolutionView>('progress')

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setAuth(data.session))
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      setAuth(s)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  if (auth === undefined) return <div className="center"><p>Cargando…</p></div>
  if (!auth) return (
    <>
      <Login />
      <UpdateBanner />
    </>
  )
  if (recovering) return <PasswordRecovery onDone={() => setRecovering(false)} />

  return (
    <DataProvider>
      <RestProvider>
      <UpdateBanner />
      <main>
        <header className="app-header">
          <a className="brand" href="#inicio" onClick={(event) => { event.preventDefault(); setTab('today') }} aria-label="Entreno, ir a Hoy">
            <span className="brand-glyph" aria-hidden="true">E</span>
            <span>ENTRENO<span className="brand-period">.</span><small>FUERZA · PROGRESO</small></span>
          </a>
          <span className="online-chip"><i /> DATOS AL DÍA</span>
        </header>
        {tab === 'today' && <Today />}
        {tab === 'evolution' && <>
          <div className="subtabs" aria-label="Vistas de evolución">
            <button className={evolutionView === 'progress' ? 'active' : ''} onClick={() => setEvolutionView('progress')}>Progreso</button>
            <button className={evolutionView === 'history' ? 'active' : ''} onClick={() => setEvolutionView('history')}>Historial</button>
          </div>
          {evolutionView === 'progress' ? <Progress /> : <HistoryTab />}
        </>}
        {tab === 'gym' && <Gym />}
        {tab === 'settings' && <SettingsTab />}
      </main>
      <nav className="tabs">
        {TABS.map(([k, label, icon]) => (
          <button key={k} className={tab === k ? 'active' : ''} aria-current={tab === k ? 'page' : undefined} onClick={() => setTab(k)}>
            <TabIcon name={icon} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      </RestProvider>
    </DataProvider>
  )
}
