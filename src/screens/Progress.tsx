import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../store'
import { totalLoad } from '../lib/progression'
import { toISODate } from '../lib/plan'
import type { Exercise } from '../types'

interface Row {
  exercise_id: string
  reps: number | null
  load_kg: number | null
  session_id: string
  sessions: { date: string } | { date: string }[]
}

/** Rango semanal de series directas por músculo (evidencia: ~10-20 grandes, 6-12 pequeños). */
const TARGETS: Record<string, [number, number]> = {
  Pecho: [8, 14],
  Espalda: [10, 16],
  Hombros: [8, 14],
  Trapecio: [2, 6],
  Bíceps: [6, 12],
  Tríceps: [6, 12],
  Cuádriceps: [6, 12],
  Isquiotibiales: [4, 10],
  Glúteos: [4, 10],
  Aductores: [2, 6],
  Gemelos: [6, 10],
  Abdomen: [4, 8],
}

interface Trend {
  ex: Exercise
  first: number
  last: number
  sessions: number
  status: 'up' | 'flat' | 'stalled'
}

/** Ventana móvil de 7 días (no dependes de un calendario fijo). */
function sevenDaysAgo(): string {
  return toISODate(new Date(Date.now() - 6 * 86400000))
}

async function loadAllSets(): Promise<Row[]> {
  const out: Row[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('sets')
      .select('exercise_id,reps,load_kg,session_id,sessions!inner(date)')
      .eq('done', true)
      .eq('is_warmup', false)
      .range(from, from + 999)
    if (error) throw error
    out.push(...(data as unknown as Row[]))
    if (!data || data.length < 1000) break
  }
  return out
}

export default function Progress() {
  const { exercises } = useData()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    loadAllSets().then(setRows).catch((e) => setErr(String(e.message ?? e)))
  }, [])

  const exById = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises])
  const dateOf = (r: Row) => (Array.isArray(r.sessions) ? r.sessions[0].date : r.sessions.date)

  const weekly = useMemo(() => {
    const monday = sevenDaysAgo()
    const counts = new Map<string, number>()
    for (const r of rows ?? []) {
      if (dateOf(r) < monday) continue
      const m = exById.get(r.exercise_id)?.muscle_primary
      if (m) counts.set(m, (counts.get(m) ?? 0) + 1)
    }
    return counts
  }, [rows, exById])

  const trends = useMemo(() => {
    const per = new Map<string, Map<string, { date: string; top: number | null; vol: number }>>()
    for (const r of rows ?? []) {
      const ex = exById.get(r.exercise_id)
      if (!ex) continue
      const load = totalLoad(r.load_kg, ex.load_type, ex.bar_kg)
      const bySession = per.get(ex.id) ?? new Map()
      const cur = bySession.get(r.session_id) ?? { date: dateOf(r), top: null, vol: 0 }
      if (load != null) {
        cur.top = cur.top == null ? load : ex.load_type === 'assistance' ? Math.min(cur.top, load) : Math.max(cur.top, load)
        cur.vol += (r.reps ?? 0) * (ex.load_type === 'assistance' ? 0 : load)
      }
      bySession.set(r.session_id, cur)
      per.set(ex.id, bySession)
    }
    const out: Trend[] = []
    for (const [id, bySession] of per) {
      const ex = exById.get(id)!
      const list = [...bySession.values()].filter((s) => s.top != null).sort((a, b) => a.date.localeCompare(b.date))
      if (list.length < 2) continue
      const better = (a: number, b: number) => (ex.load_type === 'assistance' ? a < b : a > b)
      const first = list[0].top!
      const last = list[list.length - 1].top!
      const recent = list.slice(-3)
      const improvedRecently = recent.some((s, i) => i > 0 && (better(s.top!, recent[0].top!) || (s.top === recent[0].top && s.vol > recent[0].vol * 1.03)))
      let status: Trend['status'] = 'flat'
      if (better(last, first)) status = 'up'
      if (list.length >= 3 && !improvedRecently) status = 'stalled'
      out.push({ ex, first, last, sessions: list.length, status })
    }
    return out
  }, [rows, exById])

  if (err) return <div className="screen"><p className="err">{err}</p></div>

  const up = trends.filter((t) => t.status === 'up').sort((a, b) => a.ex.name.localeCompare(b.ex.name))
  const stalled = trends.filter((t) => t.status === 'stalled').sort((a, b) => a.ex.name.localeCompare(b.ex.name))

  return (
    <div className="screen">
      <h2>Progreso</h2>
      {rows === null && <p>Cargando…</p>}

      {rows && (
        <>
          <section className="card">
            <h3>Series de los últimos 7 días por músculo</h3>
            <p className="muted">Objetivo semanal entre paréntesis. Verde = dentro del rango.</p>
            {Object.entries(TARGETS).map(([m, [lo, hi]]) => {
              const n = weekly.get(m) ?? 0
              const cls = n >= lo && n <= hi ? 'ok' : n > hi ? 'warn-t' : ''
              return (
                <div className="bar" key={m}>
                  <span>{m}</span>
                  <div className="track"><div className={`fill ${cls}`} style={{ width: `${Math.min(100, (n / hi) * 100)}%` }} /></div>
                  <span className={cls}>{n} <small>({lo}-{hi})</small></span>
                </div>
              )
            })}
          </section>

          <section className="card">
            <h3>Subiendo ({up.length})</h3>
            {up.length === 0 && <p className="muted">Aún no hay suficientes sesiones.</p>}
            {up.map((t) => (
              <p key={t.ex.id}>
                <strong>{t.ex.name}</strong> <span className="muted">{t.first} → {t.last} kg ({t.sessions} ses.)</span>
              </p>
            ))}
          </section>

          <section className="card">
            <h3>Estancados ({stalled.length})</h3>
            <p className="muted">Sin mejora de carga ni volumen en las últimas 3 sesiones: sube un escalón o varía el rango de reps.</p>
            {stalled.map((t) => (
              <p key={t.ex.id}>
                <strong>{t.ex.name}</strong> <span className="muted">{t.last} kg ({t.sessions} ses.)</span>
              </p>
            ))}
          </section>
        </>
      )}

      <CardioWeek />
    </div>
  )
}

function CardioWeek() {
  const [hard, setHard] = useState(0)
  const [med, setMed] = useState(0)
  const [soft, setSoft] = useState(0)
  const [lastSpeech, setLastSpeech] = useState<string | null>(null)
  useEffect(() => {
    void supabase
      .from('cardio_logs')
      .select('kind,minutes,speech_test,date')
      .gte('date', sevenDaysAgo())
      .order('date', { ascending: false })
      .then(({ data }) => {
        let h = 0
        let m = 0
        let sMin = 0
        for (const r of data ?? []) {
          if (r.kind === 'intervalos') h += 1
          else if (r.kind === 'media') m += 1
          else sMin += Number(r.minutes)
        }
        setHard(h)
        setMed(m)
        setSoft(sMin)
        setLastSpeech((data ?? []).find((r) => r.speech_test)?.speech_test ?? null)
      })
  }, [])
  const label = lastSpeech === 'entera' ? 'entera' : lastSpeech === 'dos' ? 'partida en dos' : lastSpeech === 'mitad' ? 'no pasó de la mitad' : '—'
  return (
    <section className="card">
      <h3>Cardio de los últimos 7 días</h3>
      <p>Dura: <strong className={hard >= 1 && hard <= 3 ? 'ok' : ''}>{hard}</strong> <span className="muted">(máx. 3, nunca días seguidos)</span></p>
      <p>Media: <strong>{med}</strong></p>
      <p>Suave: <strong>{Math.round(soft)} min</strong></p>
      <p className="muted">Último test de habla: {label}</p>
    </section>
  )
}
