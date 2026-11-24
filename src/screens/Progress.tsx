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
  rir: number | null
  session_id: string
  sessions: { date: string; status: string } | { date: string; status: string }[]
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
  Abdomen: [6, 12],
}

async function loadAllSets(): Promise<Row[]> {
  const out: Row[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('sets')
      .select('exercise_id,reps,load_kg,rir,session_id,sessions!inner(date,status)')
      .eq('done', true)
      .eq('is_warmup', false)
      .eq('sessions.status', 'done')
      .neq('sessions.source', 'app_incomplete')
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
  const [period, setPeriod] = useState<7 | 30 | 90>(30)
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null)

  useEffect(() => {
    loadAllSets().then(setRows).catch((e) => setErr(String(e.message ?? e)))
  }, [])

  const exById = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises])
  const dateOf = (r: Row) => (Array.isArray(r.sessions) ? r.sessions[0].date : r.sessions.date)
  const cutoff = toISODate(new Date(Date.now() - (period - 1) * 86400000))
  const visibleRows = useMemo(() => (rows ?? []).filter((r) => dateOf(r) >= cutoff), [rows, cutoff])
  const trainingDays = new Set(visibleRows.map(dateOf)).size
  const doneSets = visibleRows.length

  const weekly = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of visibleRows) {
      const m = exById.get(r.exercise_id)?.muscle_primary
      if (m) counts.set(m, (counts.get(m) ?? 0) + 1)
    }
    return counts
  }, [visibleRows, exById])

  if (err) return <div className="screen"><p className="err">{err}</p></div>

  return (
    <div className="screen">
      <h2>Progreso</h2>
      {rows === null && <p>Cargando…</p>}

      {rows && (
        <>
          <section className="card evolution-range-card">
            <div><span className="eyebrow">TU PERIODO</span><h3>Lee tu progreso con contexto</h3></div>
            <div className="subtabs evolution-range" aria-label="Periodo de análisis">
              {([7, 30, 90] as const).map((d) => <button key={d} className={period === d ? 'active' : ''} onClick={() => setPeriod(d)}>{d} días</button>)}
            </div>
            <div className="evolution-kpis">
              <div><strong>{trainingDays}</strong><span>días entrenados</span></div>
              <div><strong>{doneSets}</strong><span>series efectivas</span></div>
              <div><strong>{(Math.round((doneSets / period) * 7 * 10) / 10).toFixed(1)}</strong><span>series / semana</span></div>
            </div>
          </section>
          <section className="card">
            <h3>Volumen por grupo muscular</h3>
            <p className="muted">Promedio semanal durante estos {period} días, comparado con tu rango de referencia. Toca un músculo para ver qué ejercicios aportan series.</p>
            {Object.entries(TARGETS).map(([m, [lo, hi]]) => {
              const n = Math.round(((weekly.get(m) ?? 0) * 7 / period) * 10) / 10
              const cls = n >= lo && n <= hi ? 'ok' : n > hi ? 'warn-t' : ''
              const selected = visibleRows.filter((r) => exById.get(r.exercise_id)?.muscle_primary === m)
              const expanded = selectedMuscle === m
              return (
                <div className="evolution-muscle" key={m}>
                  <button className="evolution-muscle-row" aria-expanded={expanded} onClick={() => setSelectedMuscle(expanded ? null : m)}>
                    <span>{m}</span><span className="evolution-muscle-track"><i className={cls} style={{ width: `${Math.min(100, (n / hi) * 100)}%` }} /></span>
                    <strong className={cls}>{n}<small> / sem</small></strong><span className="count">{expanded ? '−' : '+'}</span>
                  </button>
                  {expanded && <div className="evolution-muscle-detail">{[...new Set(selected.map((r) => r.exercise_id))].map((id) => <p key={id}><strong>{exById.get(id)?.name}</strong><span>{selected.filter((r) => r.exercise_id === id).length} series · {Math.round(selected.filter((r) => r.exercise_id === id).length * 7 / period * 10) / 10}/sem</span></p>)}{selected.length === 0 && <p className="muted">Sin series registradas en este periodo.</p>}</div>}
                </div>
              )
            })}
          </section>

          <ExerciseProgress rows={visibleRows} exercises={exercises} dateOf={dateOf} />
        </>
      )}

      <CardioWeek days={period} />
      <BodyWeight />
    </div>
  )
}

function ExerciseProgress({ rows, exercises, dateOf }: { rows: Row[]; exercises: Exercise[]; dateOf: (r: Row) => string }) {
  const logged = exercises.filter((ex) => rows.some((r) => r.exercise_id === ex.id)).sort((a, b) => a.name.localeCompare(b.name))
  const [exerciseId, setExerciseId] = useState('')
  const [metric, setMetric] = useState<'load' | 'reps' | 'rir'>('load')
  const activeId = logged.some((e) => e.id === exerciseId) ? exerciseId : logged[0]?.id ?? ''
  const ex = logged.find((e) => e.id === activeId)
  const points = useMemo(() => {
    if (!ex) return []
    const by = new Map<string, Row[]>()
    for (const r of rows.filter((x) => x.exercise_id === ex.id)) by.set(r.session_id, [...(by.get(r.session_id) ?? []), r])
    return [...by.values()].map((sets) => {
      const loads = sets.map((s) => totalLoad(s.load_kg, ex.load_type, ex.bar_kg)).filter((x): x is number => x != null)
      const load = loads.length ? (ex.load_type === 'assistance' ? Math.min(...loads) : Math.max(...loads)) : null
      const reps = sets.map((s) => s.reps).filter((x): x is number => x != null)
      const rirs = sets.map((s) => s.rir).filter((x): x is number => x != null)
      return { date: dateOf(sets[0]), value: metric === 'load' ? load : metric === 'reps' ? (reps.length ? Math.max(...reps) : null) : (rirs.length ? Math.round(rirs.reduce((a, b) => a + b, 0) / rirs.length * 10) / 10 : null) }
    }).filter((p): p is { date: string; value: number } => p.value != null).sort((a, b) => a.date.localeCompare(b.date))
  }, [rows, ex, metric, dateOf])
  const unit = metric === 'load' ? (ex?.load_type === 'assistance' ? ' kg de asistencia' : ' kg') : metric === 'reps' ? ' reps en una serie' : ' RIR medio'
  const direction = metric === 'rir' ? 'El RIR se muestra como contexto del esfuerzo; no se interpreta por sí solo como mejora.' : ex?.load_type === 'assistance' && metric === 'load' ? 'En asistencia, menos kg significa menos ayuda.' : 'Compara la misma variante y equipo a lo largo del tiempo.'
  return <section className="card exercise-progress-card">
    <div className="section-heading"><div><span className="eyebrow">TENDENCIA INDIVIDUAL</span><h3>Cómo evoluciona un ejercicio</h3></div></div>
    <label>Ejercicio<select value={activeId} onChange={(e) => setExerciseId(e.target.value)}>{logged.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
    <div className="subtabs history-metrics" aria-label="Métrica de ejercicio">
      <button className={metric === 'load' ? 'active' : ''} onClick={() => setMetric('load')}>Carga</button>
      <button className={metric === 'reps' ? 'active' : ''} onClick={() => setMetric('reps')}>Reps</button>
      <button className={metric === 'rir' ? 'active' : ''} onClick={() => setMetric('rir')}>RIR</button>
    </div>
    {points.length > 0 ? <>
      <ProgressLineChart points={points} unit={unit} />
      <div className="progress-chart-insight"><strong>{points.length > 1 ? `${points.length} sesiones comparables` : 'Primer dato de este periodo'}</strong><span>{points.length > 1 ? `${points[0].value}${unit} → ${points[points.length - 1].value}${unit}` : `${points[0].value}${unit}`}</span></div>
      <p className="muted">{direction}</p>
    </> : <p className="muted">No hay registros de {metric === 'rir' ? 'RIR' : metric === 'load' ? 'carga' : 'repeticiones'} para este ejercicio en el periodo.</p>}
    {logged.length === 0 && <p className="muted">Registra una sesión para empezar a ver la evolución por ejercicio.</p>}
  </section>
}

function ProgressLineChart({ points, unit }: { points: { date: string; value: number }[]; unit: string }) {
  const w = 340, h = 150, pad = 24
  const values = points.map((p) => p.value), min = Math.min(...values), max = Math.max(...values)
  const x = (i: number) => points.length <= 1 ? w / 2 : pad + i / (points.length - 1) * (w - pad * 2)
  const y = (v: number) => h - pad - (v - min) / (max - min || 1) * (h - pad * 2)
  const coords = points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')
  const fmt = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  return <div className="progress-chart-wrap">
    <svg viewBox={`0 0 ${w} ${h}`} className="progress-line-chart" role="img" aria-label="Evolución por sesión">
      {[0, .5, 1].map((fraction) => <line key={fraction} x1={pad} x2={w - pad} y1={pad + fraction * (h - 2 * pad)} y2={pad + fraction * (h - 2 * pad)} className="chart-grid" />)}
      {points.length > 1 && <polyline points={coords} className="chart-line" />}
      {points.map((p, i) => <g key={`${p.date}-${i}`}><circle cx={x(i)} cy={y(p.value)} r="6" className="chart-point"><title>{fmt(p.date)}: {p.value}{unit}</title></circle><text x={x(i)} y={y(p.value) - 11} textAnchor="middle" className="chart-point-label">{p.value}</text></g>)}
    </svg>
    <div className="chart-date-row"><span>{fmt(points[0].date)}</span><span>{fmt(points[points.length - 1].date)}</span></div>
  </div>
}

function BodyWeight() {
  const [list, setList] = useState<{ date: string; kg: number }[]>([])
  const [value, setValue] = useState('')

  async function load() {
    const { data } = await supabase.from('body_weight').select('date,kg').not('kg', 'is', null).order('date', { ascending: false }).limit(30)
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
      {list.length > 1 && <ProgressLineChart points={list.slice().reverse().map((x) => ({ date: x.date, value: x.kg }))} unit=" kg" />}
      {list.slice(0, 7).map((x) => <p key={x.date} className="muted">{x.date}: {x.kg} kg</p>)}
    </section>
  )
}

interface CardioRow { date: string; kind: string; minutes: number; speech_test: string | null; machine?: string | null; rpe?: number | null }

function CardioWeek({ days }: { days: number }) {
  const [rows, setRows] = useState<CardioRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const cutoff = toISODate(new Date(Date.now() - (days - 1) * 86400000))
  useEffect(() => {
    void supabase
      .from('cardio_logs')
      .select('kind,minutes,speech_test,date,machine,rpe')
      .gte('date', cutoff)
      .order('date', { ascending: true })
      .then(({ data, error: queryError }) => {
        if (queryError) { setError(queryError.message); setRows([]); return }
        setError(null)
        setRows((data ?? []).map((r) => ({ ...r, minutes: Number(r.minutes ?? 0) })) as CardioRow[])
      })
  }, [cutoff])
  const total = (rows ?? []).reduce((sum, r) => sum + r.minutes, 0)
  const intervals = (rows ?? []).filter((r) => r.kind === 'intervalos' || r.kind === 'hiit').length
  const moderate = (rows ?? []).filter((r) => r.kind === 'media' || r.kind === 'liss').length
  const gentle = (rows ?? []).filter((r) => r.kind === 'recuperacion').length
  const other = (rows ?? []).filter((r) => !['intervalos', 'hiit', 'media', 'liss', 'recuperacion'].includes(r.kind)).length
  const grouped = new Map<string, CardioRow[]>()
  for (const row of rows ?? []) {
    let key = row.date
    if (days > 7) {
      const date = new Date(`${row.date}T00:00:00`)
      date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
      key = toISODate(date)
    }
    grouped.set(key, [...(grouped.get(key) ?? []), row])
  }
  const buckets = [...grouped].map(([key, list]) => ({ key, list, minutes: list.reduce((sum, r) => sum + r.minutes, 0) }))
  const activeBucket = buckets.find((b) => b.key === selected)
  const latestSpeech = (rows ?? []).slice().reverse().find((r) => r.speech_test)?.speech_test
  const speechLabel = latestSpeech === 'entera' ? 'frase completa' : latestSpeech === 'dos' ? 'frase en dos partes' : latestSpeech === 'mitad' ? 'no salió completa' : null
  const maxMinutes = Math.max(1, ...buckets.map((b) => b.minutes))
  return (
    <section className="card">
      <span className="eyebrow">ACTIVIDAD AERÓBICA</span>
      <h3>Tu cardio · últimos {days} días</h3>
      {rows === null && <p className="muted">Cargando registros de cardio…</p>}
      {error && <p className="err">No se pudieron cargar los registros: {error}</p>}
      {rows && !error && rows.length === 0 && <div className="evolution-empty"><strong>Sin sesiones de cardio registradas en este periodo</strong><p>El cardio que guardes al terminar aparecerá aquí. Si lo hiciste fuera de la app, todavía no figura en el historial.</p></div>}
      {rows && !error && rows.length > 0 && <>
        <div className="evolution-kpis cardio-kpis">
          <div><strong>{Math.round(total)}</strong><span>minutos en total</span></div>
          <div><strong>{rows.length}</strong><span>sesiones registradas</span></div>
          <div><strong>{intervals}</strong><span>sesiones de intervalos</span></div>
        </div>
        <div className="cardio-chart" role="group" aria-label="Minutos de cardio por día o semana">
          {buckets.map((b) => <button key={b.key} className={`cardio-chart-bar ${selected === b.key ? 'selected' : ''}`} onClick={() => setSelected(selected === b.key ? null : b.key)} aria-label={`${b.key}: ${Math.round(b.minutes)} minutos`}>
            <span className="cardio-bar-value">{Math.round(b.minutes)}</span><i style={{ height: `${Math.max(5, b.minutes / maxMinutes * 100)}%` }} /><small>{new Date(`${b.key}T00:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</small>
          </button>)}
        </div>
        <p className="muted cardio-chart-help">Minutos por {days <= 7 ? 'día' : 'semana'}. Toca una barra para ver qué sesión quedó registrada.</p>
        {activeBucket && <div className="cardio-bucket-detail"><strong>{days <= 7 ? 'Día' : 'Semana desde'} {new Date(`${activeBucket.key}T00:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}</strong>
          {activeBucket.list.map((r, i) => <p key={`${r.date}-${i}`}>{r.minutes} min · {cardioName(r.kind)}{r.machine ? ` · ${r.machine}` : ''}{r.rpe != null ? ` · esfuerzo ${r.rpe}/10` : ''}</p>)}
        </div>}
        <div className="cardio-kind-legend">
          <span><i className="kind-hard" /> Intervalos: {intervals}</span><span><i className="kind-medium" /> Continuo: {moderate}</span><span><i className="kind-easy" /> Suave: {gentle}</span>{other > 0 && <span><i className="kind-other" /> Personalizado/otro: {other}</span>}
        </div>
        <p className="muted">{speechLabel ? `Último test de habla registrado: ${speechLabel}.` : 'El test de habla aún no tiene un registro en este periodo.'}</p>
      </>}
    </section>
  )
}

function cardioName(kind: string): string {
  if (kind === 'intervalos' || kind === 'hiit') return 'Intervalos'
  if (kind === 'media' || kind === 'liss') return 'Continuo medio'
  if (kind === 'recuperacion') return 'Suave/recuperación'
  return 'Personalizado/otro'
}
