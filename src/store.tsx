import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './lib/supabase'
import { seedIfEmpty } from './lib/seed'
import type { Exercise, RoutineDay, RoutineItem } from './types'

export interface Settings {
  mesocycle_start: string | null
  rest_seconds: number
  week_offset: number
}

interface Data {
  exercises: Exercise[]
  days: RoutineDay[]
  items: RoutineItem[]
  settings: Settings
  reload: () => Promise<void>
}

const Ctx = createContext<Data | null>(null)

export function useData(): Data {
  const v = useContext(Ctx)
  if (!v) throw new Error('useData fuera de DataProvider')
  return v
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<Data, 'reload'> | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      await seedIfEmpty()
      const [ex, d, it, st] = await Promise.all([
        supabase.from('exercises').select('*').order('name'),
        supabase.from('routine_days').select('*').order('weekday'),
        supabase.from('routine_items').select('*').order('position'),
        supabase.from('settings').select('*').maybeSingle(),
      ])
      for (const r of [ex, d, it, st]) if (r.error) throw r.error
      setState({
        exercises: ex.data as Exercise[],
        days: d.data as RoutineDay[],
        items: it.data as RoutineItem[],
        settings: (st.data as Settings | null) ?? { mesocycle_start: null, rest_seconds: 120, week_offset: 0 },
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  if (error) return <div className="center"><p className="err">No se pudieron cargar los datos: {error}</p></div>
  if (!state) return <div className="center"><p>Cargando…</p></div>
  return <Ctx.Provider value={{ ...state, reload }}>{children}</Ctx.Provider>
}
