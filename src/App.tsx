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
import { RestBar, RestProvider } from './rest'
import UpdateBanner from './UpdateBanner'

type Tab = 'today' | 'progress' | 'history' | 'gym' | 'settings'

const TABS: [Tab, string][] = [
  ['today', 'Hoy'],
  ['progress', 'Progreso'],
  ['history', 'Historial'],
  ['gym', 'Gimnasio'],
  ['settings', 'Ajustes'],
]

export default function App() {
  const [auth, setAuth] = useState<AuthSession | null | undefined>(undefined)
  const [tab, setTab] = useState<Tab>('today')

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setAuth(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setAuth(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (auth === undefined) return <div className="center"><p>Cargando…</p></div>
  if (!auth) return (
    <>
      <Login />
      <UpdateBanner />
    </>
  )

  return (
    <DataProvider>
      <RestProvider>
      <UpdateBanner />
      <main>
        {tab === 'today' && <Today />}
        {tab === 'progress' && <Progress />}
        {tab === 'history' && <HistoryTab />}
        {tab === 'gym' && <Gym />}
        {tab === 'settings' && <SettingsTab />}
      </main>
      <RestBar />
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
