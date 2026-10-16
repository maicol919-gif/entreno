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
import Body from './screens/Body'
import Food from './screens/Food'
import { RestBar, RestProvider } from './rest'
import UpdateBanner from './UpdateBanner'

type Tab = 'today' | 'food' | 'progress' | 'body' | 'history' | 'gym' | 'settings'

const TABS: [Tab, string][] = [
  ['today', 'Hoy'],
  ['food', 'Comida'],
  ['progress', 'Progreso'],
  ['body', 'Cuerpo'],
  ['history', 'Historial'],
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
        {tab === 'food' && <Food />}
        {tab === 'progress' && <Progress />}
        {tab === 'body' && <Body />}
        {tab === 'history' && <HistoryTab />}
        {tab === 'gym' && (
          <>
            <button className="back" onClick={() => setTab('settings')}>← Ajustes</button>
            <Gym />
          </>
        )}
        {tab === 'settings' && <SettingsTab onOpenGym={() => setTab('gym')} />}
      </main>
      <RestBar />
      <nav className="tabs">
        {TABS.map(([k, label]) => (
          <button key={k} className={tab === k || (k === 'settings' && tab === 'gym') ? 'active' : ''} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </nav>
      </RestProvider>
    </DataProvider>
  )
}
