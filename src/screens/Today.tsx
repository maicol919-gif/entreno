import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../store'
import { adjustForSoreness, cardioFor, prescribe, toISODate, type Prescription } from '../lib/plan'
import { blockFor, itemsForBlock, nextBlockStart } from '../lib/rotation'
import { computeCycles, nextPendingDay, type CycleSession } from '../lib/cycles'
import { alternatives } from '../lib/alternatives'
import { readRun } from '../lib/cardioRun'
import type { Exercise, RoutineItem, Session } from '../types'
import ExerciseView from './ExerciseView'
import Cardio from './Cardio'
import { cardioPhase, levelMinutes, type LegContext } from '../lib/treadmill'
import { TIME_OPTIONS, fitToTime } from '../lib/timeBudget'
import { useRest } from '../rest'
import { useKeepAwake } from '../lib/keepAwake'

interface CycleSummary {
  sessions: number
  sets: number
  cardioMin: number
  /** sesiones repetidas (un día hecho más de una vez en el ciclo) */
  repeated: number
  days: Record<number, string>
}

interface Flag {
  reason: string | null
  date: string
}

const ACK_KEY = 'entreno.cycle.ack'

/** Agujetas de pierna con palabras: más alto = más dolor (no cómo de bien te sentiste). */
const SORENESS_LEVELS: { value: number; label: string; hint: string }[] = [
  { value: 0, label: 'Nada', hint: 'las piernas se sienten normales' },
  { value: 2, label: 'Leves', hint: 'las noto un poco al caminar o bajar escaleras' },
  { value: 4, label: 'Moderadas', hint: 'molestan, pero camino normal' },
  { value: 6, label: 'Fuertes', hint: 'me cuesta bajar escaleras o sentarme' },
  { value: 8, label: 'Muy fuertes', hint: 'camino con dificultad' },
  { value: 10, label: 'No puedo caminar', hint: 'el dolor me limita casi todo' },
]

const BUDGET_KEY = 'entreno.timeBudget'

/** Tiempo disponible elegido hoy (se recuerda solo durante el día). */
function readBudget(): number | null {
  try {
    const v = JSON.parse(localStorage.getItem(BUDGET_KEY) ?? 'null') as { date: string; minutes: number | null } | null
    return v && v.date === toISODate(new Date()) ? v.minutes : null
  } catch {
    return null
  }
}

function writeBudget(minutes: number | null) {
  try {
    localStorage.setItem(BUDGET_KEY, JSON.stringify({ date: toISODate(new Date()), minutes }))
  } catch {
    /* sin almacenamiento: vale solo mientras la pantalla esté abierta */
  }
}

function readAck(): string | null {
  try {
    return localStorage.getItem(ACK_KEY)
  } catch {
    return null
  }
}

export default function Today() {
  const { days, items, exercises, settings, reload } = useData()
  const { clear: clearRest } = useRest()
  const now = useMemo(() => new Date(), [])
  const today = toISODate(now)
  const [dayId, setDayId] = useState<string | null>(null)
  const dayIdRef = useRef<string | null>(null)
  dayIdRef.current = dayId
  const [completed, setCompleted] = useState(0)
  const [cycleDays, setCycleDays] = useState<Record<number, string>>({})
  /** número de día -> series hechas ese día en el ciclo actual */
  const [cycleSets, setCycleSets] = useState<Record<number, number>>({})
  const [confirmFinish, setConfirmFinish] = useState(false)
  const [budget, setBudgetState] = useState<number | null>(() => readBudget())
  const touched = useRef(false)
  const autoOpened = useRef(false)
  const [legCtx, setLegCtx] = useState<LegContext>({ yesterday: false, soreness: null })
  /** El ciclo avanza al completar los 5 días (en cualquier orden), sin depender del calendario. */
  const week = Math.max(1, 1 + completed + (settings.week_offset ?? 0))
  const [rawSession, setSession] = useState<Session | null>(null)
  const [pendingDay, setPendingDay] = useState<string | null>(null)
  const [doneCount, setDoneCount] = useState<Record<string, number>>({})
  const [openItem, setOpenItem] = useState<RoutineItem | null>(null)
  const [pendingSoreness, setPendingSoreness] = useState<Session | null>(null)
  const [lastSoreness, setLastSoreness] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [openCardio, setOpenCardio] = useState(false)
  const [cardioMin, setCardioMin] = useState(0)
  const [summary, setSummary] = useState<CycleSummary | null>(null)
  const [ack, setAck] = useState<string | null>(() => readAck())
  const [flags, setFlags] = useState<Record<string, Flag>>({})
  // la pantalla no se apaga mientras la sesión de entreno está en curso
  // la sesión de hoy solo se muestra en su propio día: otro día se ve como un día nuevo (sin cardio ni series hechas)
  const session = rawSession && (!dayId || rawSession.day_id === dayId) ? rawSession : null
  const doneTotal = Object.values(doneCount).reduce((a, n) => a + n, 0)
  useKeepAwake(rawSession?.status === 'in_progress')

  const day = days.find((d) => d.id === dayId) ?? null
  const exById = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises])

  const refresh = useCallback(async () => {
    const { data: s } = await supabase.from('sessions').select('*').eq('date', today).order('started_at', { ascending: false })
    const todays = (s ?? []) as Session[]
    // puede haber varias sesiones hoy (por ejemplo dos días distintos): la en curso, si no la del día seleccionado, si no la última
    const cur = todays.find((x) => x.status === 'in_progress') ?? todays.find((x) => x.day_id === dayIdRef.current) ?? todays[0] ?? null
    setSession(cur)

    // un cardio guiado en curso se reabre solo, aunque la página se haya recargado
    const run = readRun()
    if (cur && run && run.sessionId === cur.id && !autoOpened.current) {
      autoOpened.current = true
      setOpenCardio(true)
    }

    // ciclos: un ciclo se completa al hacer los 5 días (en cualquier orden); un día repetido no cuenta doble
    const { data: doneRows } = await supabase
      .from('sessions')
      .select('id,date,day_id,started_at,sets!inner(id)')
      .eq('source', 'app')
      .eq('sets.done', true)
      .not('day_id', 'is', null)
      .order('date', { ascending: true })
      .order('started_at', { ascending: true })
    const all: CycleSession[] = (doneRows ?? []).flatMap((r) => {
      const n = days.find((d) => d.id === r.day_id)?.weekday
      return n ? [{ id: r.id as string, date: r.date as string, startedAt: r.started_at as string, dayNumber: n }] : []
    })
    // la semana y el día que toca no cambian en mitad de una sesión: se calculan sin la sesión de hoy
    const base = computeCycles(all.filter((x) => x.id !== cur?.id))
    const incl = computeCycles(all)
    setCompleted(base.completed)
    setCycleDays(base.current.days)
    const setsByDay: Record<number, number> = {}
    for (const r of doneRows ?? []) {
      const n = days.find((d) => d.id === r.day_id)?.weekday
      if (n && base.current.sessionIds.includes(r.id as string)) setsByDay[n] = (setsByDay[n] ?? 0) + ((r.sets as unknown[] | null)?.length ?? 0)
    }
    setCycleSets(setsByDay)
    if (cur && cur.status === 'done' && incl.completed > base.completed && incl.last) {
      const ids = incl.last.sessionIds
      const { count } = await supabase.from('sets').select('id', { count: 'exact', head: true }).in('session_id', ids).eq('done', true)
      const { data: cl } = await supabase.from('cardio_logs').select('minutes').in('session_id', ids)
      setSummary({
        sessions: ids.length,
        sets: count ?? 0,
        cardioMin: (cl ?? []).reduce((acc, r) => acc + Number(r.minutes), 0),
        repeated: ids.length - days.length,
        days: incl.last.days,
      })
    } else {
      setSummary(null)
    }
    if (!cur && !touched.current) {
      // el día que toca: el primer día pendiente del ciclo después del último que entrenaste
      const next = nextPendingDay(base.lastDay, new Set(Object.keys(base.current.days).map(Number)), days.length || 5)
      setDayId(days.find((d) => d.weekday === next)?.id ?? null)
    }
    if (cur) {
      if (cur.status === 'in_progress' || !touched.current) setDayId((d) => cur.day_id ?? d)
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
  }, [refresh, openItem, openCardio, dayId])

  const block = blockFor(week)
  const dayItems = itemsForBlock(items, exercises, block).filter((i) => i.day_id === dayId && i.start_week <= week).sort((a, b) => a.position - b.position)
  const dayExerciseKey = dayItems.map((i) => i.exercise_id).join(',')
  const sessionId = session?.id ?? null

  // ejercicios que incomodaron la última vez que se hicieron (y no se han vuelto a hacer sin marca)
  useEffect(() => {
    const ids = dayExerciseKey ? dayExerciseKey.split(',') : []
    if (ids.length === 0) {
      setFlags({})
      return
    }
    void (async () => {
      const [notes, sets] = await Promise.all([
        supabase.from('session_exercise_notes').select('exercise_id,session_id,uncomfortable,discomfort_reason,sessions!inner(date)').in('exercise_id', ids),
        supabase.from('sets').select('exercise_id,session_id,sessions!inner(date)').in('exercise_id', ids).eq('done', true),
      ])
      const dateOf = (r: { sessions: unknown }) => {
        const s = r.sessions as { date: string } | { date: string }[]
        return Array.isArray(s) ? s[0].date : s.date
      }
      const lastTrained = new Map<string, string>()
      for (const r of (sets.data ?? []) as unknown as { exercise_id: string; session_id: string; sessions: unknown }[]) {
        if (r.session_id === sessionId) continue
        const d = dateOf(r)
        if (d > (lastTrained.get(r.exercise_id) ?? '')) lastTrained.set(r.exercise_id, d)
      }
      const out: Record<string, Flag> = {}
      for (const r of (notes.data ?? []) as unknown as { exercise_id: string; session_id: string; uncomfortable: boolean; discomfort_reason: string | null; sessions: unknown }[]) {
        if (!r.uncomfortable || r.session_id === sessionId) continue
        const d = dateOf(r)
        if (d >= (lastTrained.get(r.exercise_id) ?? '') && d >= (out[r.exercise_id]?.date ?? '')) out[r.exercise_id] = { reason: r.discomfort_reason, date: d }
      }
      setFlags(out)
    })()
  }, [dayExerciseKey, sessionId, openItem])

  // elegir otro día: con la sesión en curso también se puede (si te equivocaste), y la sesión pasa al día elegido
  function chooseDay(id: string | null) {
    if (rawSession?.status === 'in_progress' && id && id !== rawSession.day_id) {
      setPendingDay(id) // con una sesión en curso, antes de cambiar se pide confirmación
      return
    }
    touched.current = true
    setDayId(id)
  }

  async function confirmChangeDay() {
    if (!rawSession || !pendingDay) return
    await supabase.from('sessions').update({ day_id: pendingDay }).eq('id', rawSession.id)
    setSession({ ...rawSession, day_id: pendingDay })
    touched.current = true
    setDayId(pendingDay)
    setPendingDay(null)
  }

  async function start() {
    if (!dayId) return
    const { data } = await supabase.from('sessions').insert({ date: today, day_id: dayId }).select('*').single()
    if (data) setSession(data as Session)
  }

  async function finish() {
    if (!session) return
    setConfirmFinish(false)
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

  function dismissSummary() {
    if (!session) return
    try {
      localStorage.setItem(ACK_KEY, session.id)
    } catch {
      /* sin almacenamiento: reaparecerá al recargar */
    }
    setAck(session.id)
  }

  async function replaceExercise(item: RoutineItem, newExerciseId: string) {
    await supabase.from('routine_items').update({ exercise_id: newExerciseId }).eq('id', item.id)
    await reload()
    setOpenItem(null)
  }

  const cardio = day ? cardioFor(day.weekday, week) : null

  function baseRx(item: RoutineItem, ex: Exercise): Prescription {
    const p = prescribe(item, ex.muscle_primary, week)
    if (['Cuádriceps', 'Isquiotibiales', 'Glúteos'].includes(ex.muscle_primary)) p.sets = adjustForSoreness(p.sets, lastSoreness)
    return p
  }

  // tiempo disponible (incluye el cardio): se recortan series y ejercicios de lo menos importante a lo más importante
  const cardioEstimate = cardio && !cardio.optional ? levelMinutes('media', cardioPhase(week).phase) : 0
  const timePlan = fitToTime(
    dayItems.flatMap((item) => {
      const ex = exById.get(item.exercise_id)
      return ex ? [{ id: item.id, sets: baseRx(item, ex).sets, position: item.position }] : []
    }),
    budget,
    cardioEstimate,
  )
  function rxFor(item: RoutineItem, ex: Exercise): Prescription {
    const p = baseRx(item, ex)
    if (budget != null) p.sets = timePlan.sets[item.id] ?? p.sets
    return p
  }
  const activeItems = dayItems.filter((i) => (timePlan.sets[i.id] ?? 1) > 0)
  const skippedItems = dayItems.filter((i) => (timePlan.sets[i.id] ?? 1) === 0)
  const totalSets = activeItems.reduce((a, i) => a + (timePlan.sets[i.id] ?? 0), 0)
  function setBudget(m: number | null) {
    writeBudget(m)
    setBudgetState(m)
  }

  const trackerDays: Record<number, string> = (() => {
    if (summary) return summary.days
    const todayNumber = rawSession?.day_id ? days.find((d) => d.id === rawSession.day_id)?.weekday : undefined
    return rawSession?.status === 'done' && todayNumber && !(todayNumber in cycleDays) ? { ...cycleDays, [todayNumber]: today } : cycleDays
  })()
  const shortDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

  const missing = activeItems
    .map((item) => {
      const ex = exById.get(item.exercise_id)
      return ex ? { name: ex.name, done: doneCount[ex.id] ?? 0, sets: rxFor(item, ex).sets } : null
    })
    .filter((x): x is { name: string; done: number; sets: number } => x != null && x.done < x.sets)
  const cardioMissing = !!cardio && cardioMin === 0
  const askFinish = () => (missing.length === 0 && !(cardioMissing && !cardio?.optional) ? void finish() : setConfirmFinish(true))

  if (openItem && session) {
    const ex = exById.get(openItem.exercise_id)
    if (!ex) return null
    const idx = activeItems.findIndex((i) => i.id === openItem.id)
    const nextItem = idx >= 0 ? activeItems[idx + 1] ?? null : null
    const nextEx = nextItem ? exById.get(nextItem.exercise_id) : null
    const flag = flags[ex.id] ?? null
    return (
      <ExerciseView
        key={openItem.id + ex.id}
        exercise={ex}
        sessionId={session.id}
        rx={rxFor(openItem, ex)}
        restSeconds={settings.rest_seconds}
        onBack={() => setOpenItem(null)}
        nextName={nextEx?.name ?? (cardio ? 'Cardio en cinta' : null)}
        onNext={() => {
          window.scrollTo({ top: 0 })
          if (nextItem) setOpenItem(nextItem)
          else {
            setOpenItem(null)
            setOpenCardio(true)
          }
        }}
        flag={flag}
        alts={flag ? alternatives(ex, exercises, dayItems.map((i) => i.exercise_id), flag.reason) : []}
        onReplace={(id) => void replaceExercise(openItem, id)}
      />
    )
  }

  if (openCardio && session && cardio) {
    return <Cardio plan={cardio} sessionId={session.id} legCtx={legCtx} week={week} onBack={() => setOpenCardio(false)} />
  }

  if (loading) return <div className="screen"><p>Cargando…</p></div>

  const showSummary = !!summary && !!session && ack !== session.id

  return (
    <div className="screen">
      <h2>{day ? `Día ${day.weekday} · ${day.name}` : 'Descanso'}</h2>
      <p className="muted">Ciclo {week} · Bloque {block} (cambia en el ciclo {nextBlockStart(week)}) · toca el siguiente día de tu rutina, sin importar la fecha.</p>

      {!session && completed >= 1 && Object.keys(cycleDays).length === 0 && (
        <section className="card last">
          <h3>🎉 Hoy empieza el ciclo {week}</h3>
          <p className="muted">Completaste los 5 días del ciclo anterior. Empiezas de nuevo con las cargas que dejaste en el historial.</p>
        </section>
      )}

      {showSummary && summary && (
        <section className="card last">
          <h3>🎉 Ciclo {week} completado</h3>
          <p>{summary.sessions} sesiones · {summary.sets} series · {Math.round(summary.cardioMin)} min de cardio</p>
          {summary.repeated > 0 && <p className="muted">{summary.repeated} sesión(es) repetida(s) de un día ya hecho.</p>}
          <p className="muted">
            El siguiente día que entrenes empieza el ciclo {week + 1}
            .
          </p>
          <button className="primary" onClick={dismissSummary}>Entendido, empezar ciclo nuevo</button>
        </section>
      )}

      {pendingSoreness && !!day?.name.startsWith('Pierna') && (
        <section className="card warn">
          <h3>¿Qué tan adoloridas están tus piernas?</h3>
          <p className="muted">Sesión del {pendingSoreness.date}. Mide el dolor muscular (agujetas): más alto = más dolor, no cómo de bien te sentiste.</p>
          {SORENESS_LEVELS.map((l) => (
            <button key={l.value} className="choice" onClick={() => saveSoreness(l.value)}>
              <strong>{l.label}</strong> <span className="muted">· {l.hint}</span>
            </button>
          ))}
        </section>
      )}

      <section className="card">
        <h3>Ciclo {week}: tus 5 días</h3>
        <div className="daychips">
          {days.map((d) => {
            const date = trackerDays[d.weekday]
            return (
              <button
                key={d.id}
                className={`daychip ${date ? 'done' : ''} ${dayId === d.id ? 'sel' : ''}`}
                onClick={() => chooseDay(d.id)}
              >
                <strong>Día {d.weekday}</strong>
                <span>{date ? `✓ ${shortDate(date)}` : 'pendiente'}</span>
              </button>
            )
          })}
        </div>
        {pendingDay && rawSession && (
          <div className="card warn">
            <h3>¿Cambiar la sesión en curso?</h3>
            <p>
              Hoy empezaste el Día {days.find((d) => d.id === rawSession.day_id)?.weekday}
              {doneTotal > 0 && <> y ya tienes {doneTotal} series marcadas</>}. Si cambias, esta sesión pasa a ser el Día {days.find((d) => d.id === pendingDay)?.weekday} (tus series se guardan igual).
            </p>
            <button className="primary" onClick={() => void confirmChangeDay()}>Sí, cambiar al Día {days.find((d) => d.id === pendingDay)?.weekday}</button>
            <button onClick={() => setPendingDay(null)}>No, seguir con mi sesión</button>
          </div>
        )}
        <p className="muted">Toca un día para ver su rutina. Si ya tienes una sesión en curso, te pedirá confirmar antes de cambiarla. Un día repetido no cuenta doble; el ciclo se completa con los 5.</p>
      </section>

      <label className="muted">
        Día de rutina
        <select value={dayId ?? ''} onChange={(e) => chooseDay(e.target.value || null)}>
          <option value="">Descanso</option>
          {days.map((d) => <option key={d.id} value={d.id}>Día {d.weekday} · {d.name}{trackerDays[d.weekday] ? ' ✓' : ''}</option>)}
        </select>
      </label>

      {!day && <section className="card"><h3>Día de descanso</h3><p>Camina 30–45 min, duerme bien y come tu proteína.</p></section>}

      {day && (
        <section className="card">
          <h3>{day.name}</h3>
          {!session && (
            <>
              <p className="muted">¿Cuánto tiempo tienes hoy? (incluye el cardio)</p>
              <div className="timechips">
                {TIME_OPTIONS.map((m) => (
                  <button key={m} className={`levelchip ${budget === m ? 'on' : ''}`} onClick={() => setBudget(m)}>
                    <strong>{m} min</strong>
                  </button>
                ))}
                <button className={`levelchip ${budget == null ? 'on' : ''}`} onClick={() => setBudget(null)}>
                  <strong>Sin límite</strong>
                </button>
              </div>
              <p className="muted">
                {budget == null
                  ? `Rutina completa: ${totalSets} series · ≈${timePlan.totalMin} min con cardio.`
                  : `Para ${budget} min: ${totalSets} series en ${activeItems.length} ejercicios${timePlan.trimmed ? ' (recortado)' : ''} · cardio ${timePlan.cardioMin} min · ≈${timePlan.totalMin} min.`}
              </p>
              {skippedItems.length > 0 && (
                <p className="muted">
                  Se omiten por tiempo: {skippedItems.map((i) => exById.get(i.exercise_id)?.name).filter(Boolean).join(', ')}.
                </p>
              )}
              {timePlan.overBudget && <p className="fixed">Aun recortando, esta rutina pide más de {budget} min. Puedes empezar igual y terminar cuando debas.</p>}
              {day && cycleDays[day.weekday] && (
                <p className="ok">Hecho el {shortDate(cycleDays[day.weekday])}{cycleSets[day.weekday] ? ' · ' + cycleSets[day.weekday] + ' series' : ''} ✔ en este ciclo. Si lo repites, no cuenta doble.</p>
              )}
              <button className="primary" onClick={start}>{day && cycleDays[day.weekday] ? 'Repetir este día' : 'Empezar sesión'}</button>
            </>
          )}
          {session && budget != null && session.status === 'in_progress' && <p className="muted">Plan para {budget} min · ≈{timePlan.totalMin} min con cardio.</p>}
          {session?.status === 'done' && <p className="ok">Sesión terminada ✔ <button className="link" onClick={reopen}>reabrir</button></p>}
        </section>
      )}

      {day && session && (
        <>
          {activeItems.map((item) => {
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
                    {flags[ex.id] ? ' · ⚠ te incomodó la última vez' : ''}
                  </small>
                </span>
                <span className="count">{done}/{rx.sets}</span>
              </button>
            )
          })}
          {cardio && (
            <button className={`exrow ${cardioMin > 0 ? 'finished' : ''}`} onClick={() => setOpenCardio(true)}>
              <span>
                <strong>Cardio en cinta</strong>
                <small>Al final de la fuerza · el nivel (dura, media o suave) depende de tus piernas{cardio.optional ? ' · opcional' : ''}</small>
              </span>
              <span className="count">{cardioMin > 0 ? `${Math.round(cardioMin)} min ✓` : '›'}</span>
            </button>
          )}
          {session.status === 'in_progress' && !confirmFinish && (
            <button className="primary" onClick={askFinish}>Terminar sesión</button>
          )}
          {session.status === 'in_progress' && confirmFinish && (
            <section className="card warn">
              <h3>Aún falta algo</h3>
              {missing.map((m) => <p key={m.name}>{m.name}: {m.done}/{m.sets} series</p>)}
              {cardioMissing && <p>Cardio sin registrar{cardio?.optional ? ' (opcional hoy)' : ''}.</p>}
              <button className="primary" onClick={() => void finish()}>Terminar igual</button>
              <button onClick={() => setConfirmFinish(false)}>Seguir entrenando</button>
            </section>
          )}
        </>
      )}
    </div>
  )
}
