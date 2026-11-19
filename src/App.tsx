import { useEffect, useState } from 'react'
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

const TABS: [Tab, string][] = [
  ['today', 'Hoy'],
  ['evolution', 'Evolución'],
  ['gym', 'Gimnasio'],
  ['settings', 'Ajustes'],
]

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
        {TABS.map(([k, label]) => (
          <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </nav>
      </RestProvider>
    </DataProvider>
  )
}
