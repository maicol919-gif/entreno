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

function mondayOf(d: Date): string {
  const x = new Date(d)
  const wd = x.getDay() === 0 ? 7 : x.getDay()
  x.setDate(x.getDate() - (wd - 1))
  return toISODate(x)
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
    const monday = mondayOf(new Date())
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
            <h3>Series de esta semana por músculo</h3>
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

      <BodyWeight />
    </div>
  )
}

function BodyWeight() {
  const [list, setList] = useState<{ date: string; kg: number }[]>([])
  const [value, setValue] = useState('')

  async function load() {
    const { data } = await supabase.from('body_weight').select('date,kg').order('date', { ascending: false }).limit(30)
    setList((data ?? []) as { date: string; kg: number }[])
  }
  useEffect(() => {
    void load()
  }, [])

  async function save() {
    const kg = Number(value.replace(',', '.'))
    if (!kg) return
    await supabase.from('body_weight').upsert({ date: toISODate(new Date()), kg })
    setValue('')
    await load()
  }

  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
  const cur = avg(list.slice(0, 7).map((x) => x.kg))
  const prev = avg(list.slice(7, 14).map((x) => x.kg))

  return (
    <section className="card">
      <h3>Peso corporal</h3>
      <div className="row">
        <input inputMode="decimal" placeholder="kg de hoy" value={value} onChange={(e) => setValue(e.target.value)} />
        <button onClick={save}>Guardar</button>
      </div>
      {cur != null && (
        <p>
          Media 7 días: <strong>{cur.toFixed(1)} kg</strong>
          {prev != null && <span className="muted"> ({cur - prev >= 0 ? '+' : ''}{(cur - prev).toFixed(2)} vs. semana anterior)</span>}
        </p>
      )}
      {list.slice(0, 7).map((x) => <p key={x.date} className="muted">{x.date}: {x.kg} kg</p>)}
    </section>
  )
}
