import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../store'
import { adjustForSoreness, mesocycleWeek, prescribe, toISODate, weekdayOf, type Prescription } from '../lib/plan'
import type { Exercise, RoutineItem, Session } from '../types'
import ExerciseView from './ExerciseView'

const WEEKDAYS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

export default function Today() {
  const { days, items, exercises, settings } = useData()
  const now = useMemo(() => new Date(), [])
  const today = toISODate(now)
  const week = settings.mesocycle_start ? mesocycleWeek(settings.mesocycle_start, now) : 1
  const defaultDay = days.find((d) => d.weekday === weekdayOf(now)) ?? null
  const [dayId, setDayId] = useState<string | null>(defaultDay?.id ?? null)
  const [session, setSession] = useState<Session | null>(null)
  const [doneCount, setDoneCount] = useState<Record<string, number>>({})
  const [openItem, setOpenItem] = useState<RoutineItem | null>(null)
  const [pendingSoreness, setPendingSoreness] = useState<Session | null>(null)
  const [lastSoreness, setLastSoreness] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const day = days.find((d) => d.id === dayId) ?? null
  const exById = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises])

  const refresh = useCallback(async () => {
    const { data: s } = await supabase.from('sessions').select('*').eq('date', today).order('started_at', { ascending: false }).limit(1)
    const cur = (s?.[0] as Session | undefined) ?? null
    setSession(cur)
    if (cur) {
      setDayId((d) => cur.day_id ?? d)
      const { data: sets } = await supabase.from('sets').select('exercise_id').eq('session_id', cur.id).eq('done', true)
      const c: Record<string, number> = {}
      for (const r of sets ?? []) c[r.exercise_id as string] = (c[r.exercise_id as string] ?? 0) + 1
      setDoneCount(c)
    }
    // agujetas pendientes de la última sesión de pierna terminada antes de hoy
    const legDayIds = days.filter((d) => d.name.startsWith('Pierna')).map((d) => d.id)
    if (legDayIds.length) {
      const { data: legs } = await supabase
        .from('sessions')
        .select('*')
        .in('day_id', legDayIds)
        .lt('date', today)
        .order('date', { ascending: false })
        .limit(2)
      const list = (legs ?? []) as Session[]
      setPendingSoreness(list.find((x) => x.soreness == null && x.status === 'done') ?? null)
      setLastSoreness(list.find((x) => x.soreness != null)?.soreness ?? null)
    }
    setLoading(false)
  }, [today, days])

  useEffect(() => {
    void refresh()
  }, [refresh, openItem])

  async function start() {
    if (!dayId) return
    const { data } = await supabase.from('sessions').insert({ date: today, day_id: dayId }).select('*').single()
    if (data) setSession(data as Session)
  }

  async function finish() {
    if (!session) return
    await supabase.from('sessions').update({ status: 'done', ended_at: new Date().toISOString() }).eq('id', session.id)
    void refresh()
  }

  async function reopen() {
    if (!session) return
    await supabase.from('sessions').update({ status: 'in_progress', ended_at: null }).eq('id', session.id)
    void refresh()
  }

  async function saveSoreness(v: number) {
    if (!pendingSoreness) return
    await supabase.from('sessions').update({ soreness: v }).eq('id', pendingSoreness.id)
    setLastSoreness(v)
    setPendingSoreness(null)
  }

  const dayItems = items.filter((i) => i.day_id === dayId && i.start_week <= week).sort((a, b) => a.position - b.position)

  function rxFor(item: RoutineItem, ex: Exercise): Prescription {
    const p = prescribe(item, ex.muscle_primary, week)
    if (['Cuádriceps', 'Isquiotibiales', 'Glúteos'].includes(ex.muscle_primary)) p.sets = adjustForSoreness(p.sets, lastSoreness)
    return p
  }

  if (openItem && session) {
    const ex = exById.get(openItem.exercise_id)!
    const idx = dayItems.findIndex((i) => i.id === openItem.id)
    const nextItem = idx >= 0 ? dayItems[idx + 1] ?? null : null
    const nextEx = nextItem ? exById.get(nextItem.exercise_id) : null
    return (
      <ExerciseView
        key={openItem.id}
        exercise={ex}
        sessionId={session.id}
        rx={rxFor(openItem, ex)}
        restSeconds={settings.rest_seconds}
        onBack={() => setOpenItem(null)}
        nextName={nextEx?.name ?? null}
        onNext={() => {
          window.scrollTo({ top: 0 })
          setOpenItem(nextItem)
        }}
      />
    )
  }

  if (loading) return <div className="screen"><p>Cargando…</p></div>

  return (
    <div className="screen">
      <h2>{WEEKDAYS[weekdayOf(now)]} · semana {week}</h2>
      {settings.mesocycle_start == null && <p className="muted">Define el inicio del ciclo en Ajustes.</p>}

      {pendingSoreness && (
        <section className="card warn">
          <h3>¿Cómo están tus piernas?</h3>
          <p className="muted">Sesión del {pendingSoreness.date}. 0 = nada, 10 = no puedo caminar.</p>
          <div className="scale">
            {Array.from({ length: 11 }, (_, i) => <button key={i} onClick={() => saveSoreness(i)}>{i}</button>)}
          </div>
        </section>
      )}

      <label className="muted">
        Día de rutina
        <select value={dayId ?? ''} disabled={session?.status === 'in_progress'} onChange={(e) => setDayId(e.target.value || null)}>
          <option value="">Descanso</option>
          {days.map((d) => <option key={d.id} value={d.id}>{WEEKDAYS[d.weekday]} · {d.name}</option>)}
        </select>
      </label>

      {!day && <section className="card"><h3>Día de descanso</h3><p>Camina 30–45 min, duerme bien y come tu proteína.</p></section>}

      {day && (
        <section className="card">
          <h3>{day.name}</h3>
          {!session && <button className="primary" onClick={start}>Empezar sesión</button>}
          {session?.status === 'done' && <p className="ok">Sesión terminada ✔ <button className="link" onClick={reopen}>reabrir</button></p>}
        </section>
      )}

      {day && session && (
        <>
          {dayItems.map((item) => {
            const ex = exById.get(item.exercise_id)
            if (!ex) return null
            const rx = rxFor(item, ex)
            const done = doneCount[ex.id] ?? 0
            return (
              <button key={item.id} className={`exrow ${done >= rx.sets ? 'finished' : ''}`} onClick={() => setOpenItem(item)}>
                <span>
                  <strong>{ex.name}</strong>
                  <small>
                    {rx.sets} × {rx.repMin}-{rx.repMax} · RIR {rx.rirTarget}
                    {rx.label ? ` · ${rx.label}` : ''}
                    {!ex.available ? ' · no disponible' : ''}
                  </small>
                </span>
                <span className="count">{done}/{rx.sets}</span>
              </button>
            )
          })}
          {session.status === 'in_progress' && <button className="primary" onClick={finish}>Terminar sesión</button>}
        </>
      )}
    </div>
  )
}
