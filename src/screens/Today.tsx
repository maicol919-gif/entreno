import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../store'
import { adjustForSoreness, cardioFor, prescribe, toISODate, weekdayOf, type Prescription } from '../lib/plan'
import { blockFor, itemsForBlock } from '../lib/rotation'
import { computeCycles, nextPendingDay, type CycleSession } from '../lib/cycles'
import { alternatives } from '../lib/alternatives'
import { readRun } from '../lib/cardioRun'
import type { Exercise, RoutineItem, Session } from '../types'
import ExerciseView from './ExerciseView'
import Cardio from './Cardio'
import { cardioPhase, levelMinutes, type LegContext } from '../lib/treadmill'
import { LONG_REST_SEC, TIME_OPTIONS, planToTime } from '../lib/timeBudget'
import { useRest } from '../rest'
import { useKeepAwake } from '../lib/keepAwake'
import { loadPast, fmtDate, fmtSets } from '../lib/history'
import { totalLoad } from '../lib/progression'

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
  // Los días archivados siguen disponibles para interpretar sesiones antiguas;
  // solo los activos aparecen como opciones para entrenamientos nuevos.
  const routineDays = useMemo(() => days.filter((d) => d.is_active !== false), [days])
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
  const [lastWorkout, setLastWorkout] = useState<{ date: string; name: string; status: Session['status'] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [openCardio, setOpenCardio] = useState(false)
  const [cardioMin, setCardioMin] = useState(0)
  const [summary, setSummary] = useState<CycleSummary | null>(null)
  const [ack, setAck] = useState<string | null>(() => readAck())
  const [flags, setFlags] = useState<Record<string, Flag>>({})
  // la pantalla no se apaga mientras la sesión de entreno está en curso
  // la sesión de hoy solo se muestra en su propio día: otro día se ve como un día nuevo (sin cardio ni series hechas)
  const incompleteSession = rawSession?.status === 'incomplete' || rawSession?.source === 'app_incomplete'
  const session = rawSession && !incompleteSession && (!dayId || rawSession.day_id === dayId) ? rawSession : null
  const doneTotal = Object.values(doneCount).reduce((a, n) => a + n, 0)
  useKeepAwake(rawSession?.status === 'in_progress')

  const day = days.find((d) => d.id === dayId) ?? null
  const exById = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises])

  const refresh = useCallback(async () => {
    // Cualquier sesión con series realmente marcadas sirve para mostrar la última fecha entrenada,
    // incluso si se guardó incompleta. No se usan sesiones vacías ni sesiones aún en curso.
    const { data: lastRows } = await supabase
      .from('sessions')
      .select('date,day_id,status,started_at,sets!inner(id,done)')
      .in('status', ['done', 'incomplete'])
      .eq('sets.done', true)
      .order('date', { ascending: false })
      .order('started_at', { ascending: false })
      .limit(1)
    const lastRow = lastRows?.[0] as { date: string; day_id: string | null; status: Session['status'] } | undefined
    setLastWorkout(lastRow ? {
      date: lastRow.date,
      name: days.find((d) => d.id === lastRow.day_id)?.name ?? 'Entrenamiento',
      status: lastRow.status,
    } : null)

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
      .eq('status', 'done')
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
      if (n && base.current.sessionIds.includes(r.id as string)) setsByDay[n] = (r.sets as unknown[] | null)?.length ?? 0
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
        repeated: ids.length - routineDays.length,
        days: incl.last.days,
      })
    } else {
      setSummary(null)
    }
    if (!cur && !touched.current) {
      // La rutina oficial está asociada al día real; jueves y domingo son descanso.
      const todayRoutine = routineDays.find((d) => d.calendar_weekday === weekdayOf(now))
      if (todayRoutine) setDayId(todayRoutine.id)
      else if (days.every((d) => d.calendar_weekday == null)) {
        // Compatibilidad hasta que la migración de calendario esté aplicada.
        const next = nextPendingDay(base.lastDay, new Set(Object.keys(base.current.days).map(Number)), routineDays.length || 5)
        setDayId(routineDays.find((d) => d.weekday === next)?.id ?? null)
      } else setDayId(null)
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
        .eq('status', 'done')
        .neq('source', 'app_incomplete')
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

  const starting = useRef(false)
  async function start() {
    if (!dayId || starting.current) return // evita crear dos sesiones con un doble toque
    starting.current = true
    const { data, error } = await supabase.from('sessions').insert({ date: today, day_id: dayId }).select('*').single()
    // 23505 = ya existía una sesión en curso de este día (doble toque): se usa esa
    if (error && error.code === '23505') await refresh()
    else if (data) setSession(data as Session)
    starting.current = false
  }

  async function finish(incomplete = false) {
    if (!session) return
    setConfirmFinish(false)
    clearRest()
    let result = await supabase.from('sessions').update({ status: incomplete ? 'incomplete' : 'done', ended_at: new Date().toISOString() }).eq('id', session.id)
    if (incomplete && result.error?.code === '23514') {
      result = await supabase.from('sessions').update({ status: 'done', source: 'app_incomplete', ended_at: new Date().toISOString() }).eq('id', session.id)
    }
    if (result.error) {
      setConfirmFinish(true)
      return
    }
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

  /** "No hay esta máquina": se marca como no disponible y se devuelven reemplazos del mismo músculo */
  async function markMissing(ex: Exercise): Promise<Exercise[]> {
    await supabase.from('exercises').update({ available: false }).eq('id', ex.id)
    await reload()
    return alternatives(ex, exercises, dayItems.map((i) => i.exercise_id), 'maquina')
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
  const timePlan = planToTime(
    dayItems.flatMap((item) => {
      const ex = exById.get(item.exercise_id)
      return ex ? [{ id: item.id, sets: baseRx(item, ex).sets, position: item.position, essential: ex.muscle_primary === 'Abdomen', minSets: ex.muscle_primary === 'Abdomen' ? 1 : undefined }] : []
    }),
    budget,
    cardioEstimate,
    { restSec: settings.rest_seconds, isLegDay: !!day?.name.startsWith('Pierna'), cardioOptional: cardio?.optional ?? true },
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
  const cycleDoneCount = Math.min(5, Object.keys(trackerDays).length)
  const dateLabel = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(now)
  const lastWorkoutDays = lastWorkout
    ? Math.max(0, Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(Number(lastWorkout.date.slice(0, 4)), Number(lastWorkout.date.slice(5, 7)) - 1, Number(lastWorkout.date.slice(8, 10))) ) / 86400000))
    : null
  const lastWorkoutDate = lastWorkout ? new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(new Date(`${lastWorkout.date}T00:00:00`)) : ''
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
        restSeconds={budget != null && timePlan.longRest.includes(openItem.id) ? LONG_REST_SEC : settings.rest_seconds}
        warmup={budget != null ? timePlan.warmup[openItem.id] ?? 0 : 0}
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
        onMissing={() => markMissing(ex)}
      />
    )
  }

  if (openCardio && session && cardio) {
    return <Cardio plan={cardio} sessionId={session.id} sessionDate={session.date} legCtx={legCtx} week={week} extraMin={budget != null ? timePlan.extraCardioMin : 0} onBack={() => setOpenCardio(false)} />
  }

  if (loading) return <div className="screen"><p>Cargando…</p></div>

  const showSummary = !!summary && !!session && ack !== session.id

  return (
    <div className="screen">
      <section className={`today-hero ${session?.status === 'in_progress' ? 'is-live' : ''}`}>
        <div className="hero-copy">
          <span className="eyebrow"><i /> {dateLabel}</span>
          <h1>{session?.status === 'in_progress' ? 'Sesión en marcha' : session?.status === 'done' ? '¡Entrenamiento completado!' : day ? day.name : 'Día de recuperación'}</h1>
          <p>{session?.status === 'in_progress'
            ? `${doneTotal} series guardadas · seguimos donde lo dejaste`
            : session?.status === 'done'
              ? `${doneTotal} series registradas${cardioMin > 0 ? ` · ${Math.round(cardioMin)} min de cardio` : ''} · día guardado`
              : day ? `Día ${day.weekday} · Ciclo ${week} · Bloque ${block}` : 'Recupera, recarga y vuelve más fuerte.'}</p>
          {day && <button className="hero-link" onClick={() => document.getElementById(session?.status === 'done' ? 'completed-session' : 'training-plan')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
            {session?.status === 'done' ? 'Ver resumen del día' : session ? 'Continuar sesión' : 'Preparar entrenamiento'} <span aria-hidden="true">↘</span>
          </button>}
        </div>
        <div className="cycle-orbit" aria-label={`${cycleDoneCount} de 5 días completados`}>
          <svg viewBox="0 0 82 82" role="img" aria-hidden="true">
            <circle className="orbit-track" cx="41" cy="41" r="34" />
            <circle className="orbit-value" cx="41" cy="41" r="34" style={{ strokeDashoffset: `${213.6 * (1 - cycleDoneCount / 5)}` }} />
          </svg>
          <strong>{cycleDoneCount}<small>/5</small></strong>
          <span>DÍAS</span>
        </div>
        <span className="hero-index" aria-hidden="true">0{day?.weekday ?? '·'}</span>
      </section>

      <div className="metric-strip" aria-label="Resumen de hoy">
        <div><span>SEMANA</span><strong>{week}<small> / 7</small></strong></div>
        <div><span>VOLUMEN DE HOY</span><strong>{totalSets}<small> series</small></strong></div>
        <div><span>TIEMPO ESTIMADO</span><strong>{timePlan.totalMin}<small> min</small></strong></div>
      </div>

      {lastWorkout && lastWorkoutDays != null && (
        <section className="card last" aria-label="Último entrenamiento registrado">
          <span className="eyebrow">ÚLTIMO ENTRENO REGISTRADO</span>
          <h3>{lastWorkout.name}</h3>
          <p>{lastWorkoutDate} · {lastWorkoutDays === 0 ? 'hoy' : lastWorkoutDays === 1 ? 'ayer' : `hace ${lastWorkoutDays} días`}{lastWorkout.status === 'incomplete' ? ' · guardado incompleto' : ''}</p>
          <p className="muted">La fecha sirve como contexto de recuperación; la carga se ajusta según tu rendimiento y cómo te encuentras.</p>
        </section>
      )}

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

      {incompleteSession && (
        <section className="card warn">
          <h3>Sesión incompleta guardada</h3>
          <p>{doneTotal} series{cardioMin > 0 ? ` · ${Math.round(cardioMin)} min de cardio` : ''}. Se conservan los datos; no cuenta para el ciclo ni la progresión.</p>
        </section>
      )}

      {session?.status === 'done' && (
        <section className="card workout-complete" id="completed-session" role="status" aria-live="polite">
          <div className="workout-complete-mark" aria-hidden="true">✓</div>
          <div className="workout-complete-copy">
            <span className="eyebrow">ENTRENO DE HOY</span>
            <h3>¡Día completado!</h3>
            <p className="workout-complete-stats">{day?.name ?? 'Sesión de hoy'}</p>
            <WorkoutReview sessionId={session.id} sessionDate={session.date} exercises={exercises} exerciseOrder={activeItems.map((item) => item.exercise_id)} cardioMin={cardioMin} />
            <p className="muted">Tu entrenamiento está guardado. Reabre la sesión solo si quieres revisar o editar los ejercicios.</p>
            <button className="primary" onClick={reopen}>Reabrir entrenamiento</button>
          </div>
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

      <section className="card cycle-card">
        <div className="section-heading"><div><span className="eyebrow">TU CONSTANCIA</span><h3>Ciclo {week}<small> / 5 entrenamientos</small></h3></div><span className="cycle-count">{cycleDoneCount}<small>/5</small></span></div>
        <div className="daychips">
          {routineDays.map((d) => {
            const date = trackerDays[d.weekday]
            return (
              <button
                key={d.id}
                className={`daychip ${date ? 'done' : ''} ${dayId === d.id ? 'sel' : ''}`}
                onClick={() => chooseDay(d.id)}
              >
                <strong>{d.calendar_weekday ? ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'][d.calendar_weekday] : `Día ${d.weekday}`}</strong>
                <span>{date ? `✓ ${shortDate(date)}` : dayId === d.id ? 'Elegido' : 'pendiente'}</span>
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
        <p className="muted">Borde claro = día elegido. ✓ indica que ya lo completaste en este ciclo.</p>
      </section>

      <label className="muted day-picker">
        <span>ELIGE TU DÍA</span>
        <select value={dayId ?? ''} onChange={(e) => chooseDay(e.target.value || null)}>
          <option value="">Descanso</option>
          {routineDays.map((d) => <option key={d.id} value={d.id}>{d.calendar_weekday ? `${['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'][d.calendar_weekday]} · ` : `Día ${d.weekday} · `}{d.name}{trackerDays[d.weekday] ? ' ✓' : ''}</option>)}
        </select>
      </label>

      {!day && <section className="card"><h3>Día de descanso</h3><p>Jueves y domingo son tus días previstos para recuperar. No hace falta compensarlos con una sesión doble; puedes hacer movilidad cómoda si te apetece.</p></section>}

      {day && session?.status !== 'done' && (
        <section className="card plan-card" id="training-plan">
          <div className="section-heading"><div><span className="eyebrow">PLAN DE HOY</span><h3>{day.name}</h3></div><span className="plan-spark" aria-hidden="true">✳</span></div>
          {!session && (
            <>
              <p className="muted">¿Cuánto tiempo tienes hoy? (incluye el cardio)</p>
              <p className="muted time-budget-hint">Elige tu límite máximo, no una meta que haya que llenar. Si el plan seguro termina antes, ese margen queda libre.</p>
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
                  ? !cardio
                    ? `Rutina completa: ${totalSets} series en ${activeItems.length} ejercicios · pesas ≈${timePlan.strengthMin} min.`
                    : cardio.optional
                      ? `Rutina completa: ${totalSets} series en ${activeItems.length} ejercicios · pesas ≈${timePlan.strengthMin} min · cardio suave opcional, aparte.`
                      : `Rutina completa: ${totalSets} series en ${activeItems.length} ejercicios · ≈${timePlan.totalMin} min con cardio.`
                  : `Límite ${budget} min: ${totalSets} series en ${activeItems.length} ejercicios${timePlan.trimmed ? ' (recortado)' : ''}${cardio ? ` · cardio ${cardio.optional ? 'recomendado' : 'programado'} ${timePlan.cardioMin} min` : ''} · sesión ≈${timePlan.totalMin} min${!timePlan.trimmed && timePlan.totalMin < budget ? ` · ${budget - timePlan.totalMin} min de margen` : ''}.`}
              </p>
              {skippedItems.length > 0 && (
                <p className="muted">
                  Se omiten por tiempo: {skippedItems.map((i) => exById.get(i.exercise_id)?.name).filter(Boolean).join(', ')}.
                </p>
              )}
              {budget != null && timePlan.extras.length > 0 && (
                <ul className="muted">
                  {timePlan.extras.map((x) => <li key={x}>{x}</li>)}
                </ul>
              )}
              {timePlan.overBudget && <p className="fixed">Aun recortando, esta rutina pide más de {budget} min. Puedes empezar igual y terminar cuando debas.</p>}
              {day && cycleDays[day.weekday] && (
                <p className="ok">Hecho el {shortDate(cycleDays[day.weekday])}{cycleSets[day.weekday] ? ' · ' + cycleSets[day.weekday] + ' series' : ''} ✔ en este ciclo. Si lo repites, no cuenta doble.</p>
              )}
              <button className="primary start-inline" onClick={start}>{day && cycleDays[day.weekday] ? 'Repetir este día' : 'Empezar sesión'}</button>
            </>
          )}
          {session && budget != null && session.status === 'in_progress' && <p className="muted">Plan para {budget} min · ≈{timePlan.totalMin} min con cardio.</p>}
        </section>
      )}

      {day && session?.status === 'in_progress' && (
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
              <button className="primary" onClick={() => void finish(true)}>Guardar sesión incompleta</button>
              <button onClick={() => setConfirmFinish(false)}>Seguir entrenando</button>
            </section>
          )}
        </>
      )}

      {day && !session && (
        <section className="start-dock" aria-label="Iniciar entrenamiento">
          <p>{budget == null
            ? `Rutina completa · ${totalSets} series · ≈${timePlan.totalMin} min`
            : `Plan ${budget} min · ${totalSets} series · ≈${timePlan.totalMin} min`}</p>
          <button className="primary" onClick={start}>
            {cycleDays[day.weekday] ? 'Repetir este día' : 'Empezar sesión'}
          </button>
        </section>
      )}
    </div>
  )
}

interface WorkoutSetSummary {
  exerciseId: string
  name: string
  sets: { reps: number | null; load_kg: number | null; rir: number | null; is_warmup: boolean }[]
  loadType: Exercise['load_type']
  currentTop: number | null
  previousTop: number | null
  currentBestReps: { reps: number; load: number | null } | null
  previousBestReps: { reps: number; load: number | null } | null
  previousDate: string | null
  averageRir: number | null
  highlight: string | null
}

function WorkoutReview({ sessionId, sessionDate, exercises, exerciseOrder, cardioMin }: { sessionId: string; sessionDate: string; exercises: Exercise[]; exerciseOrder: string[]; cardioMin: number }) {
  const [rows, setRows] = useState<WorkoutSetSummary[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [metric, setMetric] = useState<'load' | 'reps'>('load')
  const orderKey = exerciseOrder.join(',')
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase.from('sets').select('exercise_id,reps,load_kg,rir,is_warmup').eq('session_id', sessionId).eq('done', true).order('set_number')
      if (error || !data) { if (!cancelled) setRows([]); return }
      const grouped = new Map<string, WorkoutSetSummary['sets']>()
      for (const set of data) grouped.set(set.exercise_id, [...(grouped.get(set.exercise_id) ?? []), { reps: set.reps, load_kg: set.load_kg, rir: set.rir, is_warmup: !!set.is_warmup }])
      const result = await Promise.all([...grouped].map(async ([exerciseId, sets]): Promise<WorkoutSetSummary | null> => {
        const ex = exercises.find((item) => item.id === exerciseId)
        if (!ex) return null
        const work = sets.filter((set) => !set.is_warmup)
        const prior = await loadPast(exerciseId, sessionId).catch(() => [])
        const previous = prior[0] ?? null
        const loadOf = (set: { load_kg: number | null }) => set.load_kg
        const bestLoad = (items: { load_kg: number | null }[]) => {
          const loads = items.map(loadOf).filter((n): n is number => n != null)
          return loads.length ? (ex.load_type === 'assistance' ? Math.min(...loads) : Math.max(...loads)) : null
        }
        const bestReps = (items: { reps: number | null; load_kg: number | null }[]) => {
          const candidates = items.filter((set): set is { reps: number; load_kg: number | null } => set.reps != null)
          return candidates.length ? candidates.reduce((best, set) => set.reps > best.reps ? set : best) : null
        }
        const rirValues = work.map((set) => set.rir).filter((n): n is number => n != null)
        const currentTop = bestLoad(work)
        const previousTop = bestLoad(previous?.sets ?? [])
        const currentBestReps = bestReps(work)
        const previousBestReps = bestReps(previous?.sets ?? [])
        let highlight: string | null = null
        if (work.length && prior.length === 0) highlight = 'Primer registro guardado de este ejercicio.'
        else if (work.length && prior.length > 0) {
          const normalizedLoad = (set: { load_kg: number | null }) => totalLoad(set.load_kg, ex.load_type, ex.bar_kg)
          const currentLoads = work.map(normalizedLoad).filter((n): n is number => n != null)
          const oldLoads = prior.flatMap((session) => session.sets.map(normalizedLoad)).filter((n): n is number => n != null)
          if (currentLoads.length && oldLoads.length) {
            const currentTop = ex.load_type === 'assistance' ? Math.min(...currentLoads) : Math.max(...currentLoads)
            const oldTop = ex.load_type === 'assistance' ? Math.min(...oldLoads) : Math.max(...oldLoads)
            const improved = ex.load_type === 'assistance' ? currentTop < oldTop : currentTop > oldTop
            if (improved) highlight = `Nueva mejor marca de carga: ${currentTop} kg${ex.load_type === 'assistance' ? ' de asistencia' : ''}.`
            else {
              const sameTop = (a: number, b: number) => Math.abs(a - b) < 0.001
              const currentNormalizedTop = ex.load_type === 'assistance' ? Math.min(...currentLoads) : Math.max(...currentLoads)
              const currentReps = Math.max(...work.filter((s) => normalizedLoad(s) != null && sameTop(normalizedLoad(s)!, currentNormalizedTop)).map((s) => s.reps ?? 0))
              const oldReps = Math.max(...prior.flatMap((s) => s.sets.filter((set) => normalizedLoad(set) != null && sameTop(normalizedLoad(set)!, currentNormalizedTop)).map((set) => set.reps ?? 0)), 0)
              if (currentReps > oldReps && oldReps > 0) highlight = `Más repeticiones con ${currentNormalizedTop} kg: ${currentReps} (antes ${oldReps}).`
            }
          }
        }
        return {
          exerciseId, name: ex.name, sets, loadType: ex.load_type, currentTop, previousTop,
          currentBestReps: currentBestReps ? { reps: currentBestReps.reps, load: currentBestReps.load_kg } : null,
          previousBestReps: previousBestReps ? { reps: previousBestReps.reps, load: previousBestReps.load_kg } : null,
          previousDate: previous ? previous.date : null,
          averageRir: rirValues.length ? Math.round(rirValues.reduce((a, b) => a + b, 0) / rirValues.length * 10) / 10 : null,
          highlight,
        }
      }))
      const order = new Map(orderKey.split(',').filter(Boolean).map((id, index) => [id, index]))
      const ordered = result.filter((x): x is WorkoutSetSummary => x != null).sort((a, b) => (order.get(a.exerciseId) ?? 999) - (order.get(b.exerciseId) ?? 999))
      if (!cancelled) {
        setRows(ordered)
        setSelectedId((current) => current && ordered.some((row) => row.exerciseId === current) ? current : ordered[0]?.exerciseId ?? null)
      }
    })()
    return () => { cancelled = true }
  }, [sessionId, exercises, orderKey])

  if (rows === null) return <p className="muted">Preparando el resumen de tus series…</p>
  if (!rows.length) return null
  const selected = rows.find((row) => row.exerciseId === selectedId) ?? rows[0]
  const effectiveSets = rows.reduce((n, row) => n + row.sets.filter((set) => !set.is_warmup).length, 0)
  const records = rows.filter((row) => row.highlight?.startsWith('Nueva mejor marca') || row.highlight?.startsWith('Más repeticiones'))
  const chartValues = metric === 'load' ? [selected.previousTop, selected.currentTop] : [selected.previousBestReps?.reps ?? null, selected.currentBestReps?.reps ?? null]
  const currentDateLabel = fmtDate(sessionDate)
  const previousDateLabel = selected.previousDate ? fmtDate(selected.previousDate) : 'Primera referencia'
  const delta = chartValues[0] != null && chartValues[1] != null ? Math.round((chartValues[1] - chartValues[0]) * 10) / 10 : null
  const positiveChange = delta != null && (metric === 'load' && selected.loadType === 'assistance' ? delta < 0 : delta > 0)
  const loadLabel = selected.loadType === 'per_side' ? 'kg/lado' : selected.loadType === 'per_hand' ? 'kg/mano' : selected.loadType === 'assistance' ? 'kg ayuda' : selected.loadType === 'plates_per_side_plus_bar' ? 'kg/lado' : 'kg'
  const story = selected.previousDate
    ? metric === 'load' && delta != null
      ? delta === 0 ? 'Repetiste la carga principal de la sesión anterior.' : selected.loadType === 'assistance' ? delta < 0 ? `Hoy necesitaste ${Math.abs(delta)} kg menos de ayuda.` : `Hoy usaste ${delta} kg más de ayuda.` : delta > 0 ? `Hoy moviste ${delta} kg más que la última vez.` : `Hoy registraste ${Math.abs(delta)} kg menos que la última vez.`
      : metric === 'reps' && delta != null
        ? delta === 0 ? 'Igualaste las repeticiones máximas de la última sesión.' : delta > 0 ? `Sumaste ${delta} repeticiones en tu mejor serie.` : `Tu mejor serie tuvo ${Math.abs(delta)} repeticiones menos que la anterior.`
        : 'Aún no hay registros suficientes para comparar esta métrica.'
    : 'Primera referencia de este ejercicio: ya tienes un punto de comparación para la próxima vez.'
  const ringColors = ['#c7ff72', '#70dfb0', '#65b8ff', '#ffb86a', '#c19aff', '#ff7f91', '#70dedb', '#f2e66f']
  const ringRows = rows.filter((row) => row.sets.some((set) => !set.is_warmup))
  const ringTotal = ringRows.reduce((sum, row) => sum + row.sets.filter((set) => !set.is_warmup).length, 0)
  const ringLength = 2 * Math.PI * 46
  let ringOffset = 0
  const ringSegments = ringRows.map((row, index) => {
    const count = row.sets.filter((set) => !set.is_warmup).length
    const segment = ringTotal ? ringLength * count / ringTotal : 0
    const visible = Math.max(0, segment - 2.5)
    const offset = ringOffset
    ringOffset += segment
    return { row, count, color: ringColors[index % ringColors.length], dash: `${visible} ${ringLength - visible}`, offset: -offset }
  })
  return <div className="workout-review">
    <section className="workout-simple-summary">
      <div className="workout-simple-head"><span className="eyebrow">ENTRENO COMPLETADO · {currentDateLabel}</span><h4>{records.length ? 'Hoy superaste tu referencia' : 'Trabajo hecho.'}</h4></div>
      <div className="workout-ring-layout">
        <div className="workout-ring" role="img" aria-label={`${effectiveSets} series efectivas distribuidas en ${ringRows.length} ejercicios`}>
          <svg viewBox="0 0 120 120" aria-hidden="true"><circle className="workout-ring-track" cx="60" cy="60" r="46"/><g transform="rotate(-90 60 60)">{ringSegments.map((segment) => <circle key={segment.row.exerciseId} className={`workout-ring-segment ${segment.row.exerciseId === selected.exerciseId ? 'active' : ''}`} cx="60" cy="60" r="46" fill="none" stroke={segment.color} strokeWidth={segment.row.exerciseId === selected.exerciseId ? 13 : 10} strokeDasharray={segment.dash} strokeDashoffset={segment.offset} strokeLinecap="round" onClick={() => setSelectedId(segment.row.exerciseId)} />)}</g></svg>
          <div className="workout-ring-center"><strong>{effectiveSets}</strong><span>series</span></div>
        </div>
        <div className="workout-ring-legend">{ringSegments.slice(0, 3).map((segment) => <button key={segment.row.exerciseId} className={segment.row.exerciseId === selected.exerciseId ? 'active' : ''} onClick={() => setSelectedId(segment.row.exerciseId)}><i style={{ background: segment.color }}/><span>{segment.row.name}</span><b>{segment.count}</b></button>)}{ringSegments.length > 3 && <details className="workout-ring-more"><summary>+{ringSegments.length - 3} ejercicios</summary>{ringSegments.slice(3).map((segment) => <button key={segment.row.exerciseId} className={segment.row.exerciseId === selected.exerciseId ? 'active' : ''} onClick={() => setSelectedId(segment.row.exerciseId)}><i style={{ background: segment.color }}/><span>{segment.row.name}</span><b>{segment.count}</b></button>)}</details>}</div>
      </div>
      <div className="workout-simple-foot"><span>{rows.length} ejercicios</span>{cardioMin > 0 && <span>{Math.round(cardioMin)} min cardio</span>}{records.length > 0 && <span className="workout-record-badge">✦ {records.length} marca{records.length === 1 ? '' : 's'}</span>}</div>
    </section>
    <section className="workout-compare-simple">
      <div className="workout-compare-head"><div><span className="eyebrow">TU PROGRESO</span><h5>{selected.name}</h5></div><div className="workout-mini-switch" aria-label="Métrica"><button className={metric === 'load' ? 'active' : ''} onClick={() => setMetric('load')}>{loadLabel}</button><button className={metric === 'reps' ? 'active' : ''} onClick={() => setMetric('reps')}>reps</button></div></div>
      <div className="workout-simple-values">{chartValues.map((value, i) => <div key={i} className={i === 1 ? 'today' : ''}><span>{i === 0 ? 'ANTES' : 'HOY'}</span><strong>{value == null ? '—' : value}</strong><small>{i === 0 ? previousDateLabel : currentDateLabel}</small></div>)}<b className="workout-simple-arrow" aria-hidden="true">{delta == null ? '·' : delta === 0 ? '↔' : positiveChange ? '↗' : '↘'}</b></div>
      <p className="workout-simple-story">{story}</p>
    </section>
    <details className="workout-review-details"><summary>Ver detalle de series</summary>
      {rows.map((row) => <div className="workout-review-exercise" key={row.exerciseId}><strong>{row.name}</strong><span>{fmtSets(row.sets.filter((set) => !set.is_warmup).map((set, i) => ({ ...set, set_number: i + 1 }))) || 'Sin series efectivas registradas'}</span>{row.highlight && <small>{row.highlight}</small>}</div>)}
    </details>
  </div>
}
