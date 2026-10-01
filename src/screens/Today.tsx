import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../store'
import { adjustForSoreness, cardioFor, pendingDays, prescribe, toISODate, type Prescription } from '../lib/plan'
import type { Exercise, RoutineItem, Session } from '../types'
import ExerciseView from './ExerciseView'
import Cardio from './Cardio'
import { legReasons, type LegContext } from '../lib/treadmill'
import { useRest } from '../rest'

export default function Today() {
  const { days, items, exercises, settings } = useData()
  const { clear: clearRest } = useRest()
  const now = useMemo(() => new Date(), [])
  const today = toISODate(now)
  const [dayId, setDayId] = useState<string | null>(null)
  const [cycles, setCycles] = useState(0)
  const touched = useRef(false)
  const [pending, setPending] = useState<number[]>([])
  const [legCtx, setLegCtx] = useState<LegContext>({ yesterday: false, soreness: null })
  /** La semana del ciclo avanza al completar el Día 5, sin depender del calendario. */
  const week = Math.max(1, 1 + cycles + (settings.week_offset ?? 0))
  const [session, setSession] = useState<Session | null>(null)
  const [doneCount, setDoneCount] = useState<Record<string, number>>({})
  const [openItem, setOpenItem] = useState<RoutineItem | null>(null)
  const [pendingSoreness, setPendingSoreness] = useState<Session | null>(null)
  const [lastSoreness, setLastSoreness] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [openCardio, setOpenCardio] = useState(false)
  const [cardioMin, setCardioMin] = useState(0)

  const day = days.find((d) => d.id === dayId) ?? null
  const exById = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises])

  const refresh = useCallback(async () => {
    const { data: s } = await supabase.from('sessions').select('*').eq('date', today).order('started_at', { ascending: false }).limit(1)
    const cur = (s?.[0] as Session | undefined) ?? null
    setSession(cur)
    const lastDay5 = days.find((d) => d.weekday === 5)
    if (lastDay5) {
      const { data: c } = await supabase.from('sessions').select('id,date,sets!inner(id)').eq('day_id', lastDay5.id).eq('sets.done', true).lt('date', today)
      setCycles((c ?? []).length)
      // días del ciclo actual (desde el último Día 5 terminado) para detectar los que quedaron pendientes
      const since = (c ?? []).map((r) => r.date as string).sort().pop()
      let q = supabase.from('sessions').select('day_id,date,sets!inner(id)').eq('source', 'app').eq('sets.done', true).not('day_id', 'is', null).lt('date', today)
      if (since) q = q.gt('date', since)
      const { data: cyc } = await q
      const nums = (cyc ?? []).map((r) => days.find((d) => d.id === r.day_id)?.weekday).filter((n): n is number => n != null)
      setPending(pendingDays([...new Set(nums)]))
    }
    if (!cur && !touched.current) {
      // el día que toca es el siguiente al último día entrenado, sin importar el día de la semana
      const { data: l } = await supabase
        .from('sessions')
        .select('day_id,sets!inner(id)')
        .eq('source', 'app')
        .eq('sets.done', true)
        .not('day_id', 'is', null)
        .lt('date', today)
        .order('date', { ascending: false })
        .limit(1)
      const lastDay = days.find((d) => d.id === l?.[0]?.day_id)
      const nextNumber = lastDay ? (lastDay.weekday % days.length) + 1 : 1
      setDayId(days.find((d) => d.weekday === nextNumber)?.id ?? null)
    }
    if (cur) {
      setDayId((d) => cur.day_id ?? d)
      const { data: sets } = await supabase.from('sets').select('exercise_id').eq('session_id', cur.id).eq('done', true)
      const c: Record<string, number> = {}
      for (const r of sets ?? []) c[r.exercise_id as string] = (c[r.exercise_id as string] ?? 0) + 1
      setDoneCount(c)
      const { data: cl } = await supabase.from('cardio_logs').select('minutes').eq('session_id', cur.id)
      setCardioMin((cl ?? []).reduce((a, r) => a + Number(r.minutes), 0))
    }
    // agujetas pendientes de la última sesión de pierna terminada antes de hoy
    const legDayIds = days.filter((d) => d.name.startsWith('Pierna')).map((d) => d.id)
    if (legDayIds.length) {
      const { data: legs } = await supabase
        .from('sessions')
        .select('*,sets!inner(id)')
        .eq('sets.done', true)
        .in('day_id', legDayIds)
        .lt('date', today)
        .order('date', { ascending: false })
        .limit(2)
      const list = (legs ?? []) as Session[]
      const dayMs = 86400000
      const yesterdayISO = toISODate(new Date(Date.now() - dayMs))
      const threeDaysAgo = toISODate(new Date(Date.now() - 3 * dayMs))
      setLegCtx({
        yesterday: list.some((x) => x.date === yesterdayISO),
        soreness: list.find((x) => x.soreness != null && x.date >= threeDaysAgo)?.soreness ?? null,
      })
      setPendingSoreness(list.find((x) => x.soreness == null && x.status === 'done') ?? null)
      setLastSoreness(list.find((x) => x.soreness != null)?.soreness ?? null)
    }
    setLoading(false)
  }, [today, days])

  useEffect(() => {
    void refresh()
  }, [refresh, openItem, openCardio])

  async function start() {
    if (!dayId) return
    const { data } = await supabase.from('sessions').insert({ date: today, day_id: dayId }).select('*').single()
    if (data) setSession(data as Session)
  }

  async function finish() {
    if (!session) return
    clearRest()
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

  const cardio = day ? cardioFor(day.weekday, week) : null
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
        nextName={nextEx?.name ?? (cardio ? `Cardio · ${cardio.title}` : null)}
        onNext={() => {
          window.scrollTo({ top: 0 })
          if (nextItem) setOpenItem(nextItem)
          else {
            setOpenItem(null)
            setOpenCardio(true)
          }
        }}
      />
    )
  }

  if (openCardio && session && cardio) {
    return <Cardio plan={cardio} sessionId={session.id} legCtx={legCtx} onBack={() => setOpenCardio(false)} />
  }

  if (loading) return <div className="screen"><p>Cargando…</p></div>

  return (
    <div className="screen">
      <h2>{day ? `Día ${day.weekday} · ${day.name}` : 'Descanso'}</h2>
      <p className="muted">Semana {week} del ciclo · toca el siguiente día de tu rutina, sin importar la fecha.</p>

      {pendingSoreness && (
        <section className="card warn">
          <h3>¿Cómo están tus piernas?</h3>
          <p className="muted">Sesión del {pendingSoreness.date}. 0 = nada, 10 = no puedo caminar.</p>
          <div className="scale">
            {Array.from({ length: 11 }, (_, i) => <button key={i} onClick={() => saveSoreness(i)}>{i}</button>)}
          </div>
        </section>
      )}

      {!session && pending.length > 0 && (
        <section className="card warn">
          <h3>Día pendiente</h3>
          {pending.map((n) => {
            const d = days.find((x) => x.weekday === n)
            if (!d) return null
            return (
              <p key={n}>
                Te saltaste el <strong>Día {n} · {d.name}</strong> en este ciclo.{' '}
                <button className="link" onClick={() => { touched.current = true; setDayId(d.id) }}>Hacerlo hoy</button>
              </p>
            )
          })}
          <p className="muted">Si es de pierna y hiciste pierna ayer, mejor sigue con el día que te toca y recupéralo después.</p>
        </section>
      )}

      <label className="muted">
        Día de rutina
        <select value={dayId ?? ''} disabled={session?.status === 'in_progress'} onChange={(e) => { touched.current = true; setDayId(e.target.value || null) }}>
          <option value="">Descanso</option>
          {days.map((d) => <option key={d.id} value={d.id}>Día {d.weekday} · {d.name}</option>)}
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
          {cardio && (
            <button className={`exrow ${cardioMin > 0 ? 'finished' : ''}`} onClick={() => setOpenCardio(true)}>
              <span>
                <strong>Cardio · {cardio.title}</strong>
                <small>Al final de la fuerza · {cardio.kind === 'intervalos' ? (legReasons(legCtx).length > 0 ? 'se recomienda caminata suave (piernas cargadas)' : '4 bloques rápidos con test de habla') : 'día suave'}{cardio.optional ? ' · opcional' : ''}</small>
              </span>
              <span className="count">{cardioMin > 0 ? `${Math.round(cardioMin)} min ✓` : '›'}</span>
            </button>
          )}
          {session.status === 'in_progress' && <button className="primary" onClick={finish}>Terminar sesión</button>}
        </>
      )}
    </div>
  )
}
