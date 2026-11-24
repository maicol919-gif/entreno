import { useEffect, useState } from 'react'
import { useData } from '../store'
import { fmtDate, fmtSets, loadPast } from '../lib/history'
import { totalLoad } from '../lib/progression'
import type { Exercise, PastSession } from '../types'

export default function HistoryTab() {
  const { exercises } = useData()
  const [open, setOpen] = useState<Exercise | null>(null)
  if (open) return <ExerciseHistory ex={open} onBack={() => setOpen(null)} />

  const groups = new Map<string, Exercise[]>()
  for (const e of exercises) groups.set(e.muscle_primary, [...(groups.get(e.muscle_primary) ?? []), e])
  return (
    <div className="screen">
      <h2>Historial por ejercicio</h2>
      {[...groups.entries()].map(([muscle, list]) => (
        <section key={muscle} className="card">
          <h3>{muscle}</h3>
          {list.map((e) => (
            <button key={e.id} className="exrow" onClick={() => setOpen(e)}>
              <span><strong>{e.name}</strong></span>
              <span className="count">›</span>
            </button>
          ))}
        </section>
      ))}
    </div>
  )
}

function ExerciseHistory({ ex, onBack }: { ex: Exercise; onBack: () => void }) {
  const [past, setPast] = useState<PastSession[] | null>(null)
  const [metric, setMetric] = useState<'load' | 'reps' | 'rir'>('load')
  useEffect(() => {
    void loadPast(ex.id).then(setPast)
  }, [ex.id])

  const chronological = (past ?? []).slice(0, 12).reverse()
  const tops = chronological.map((s) => {
    const loads = s.sets.map((x) => totalLoad(x.load_kg, ex.load_type, ex.bar_kg)).filter((x): x is number => x != null)
    return loads.length ? (ex.load_type === 'assistance' ? Math.min(...loads) : Math.max(...loads)) : null
  })
  const reps = chronological.map((s) => s.sets.reduce<number | null>((best, set) => set.reps == null ? best : best == null ? set.reps : Math.max(best, set.reps), null))
  const rir = chronological.map((s) => {
    const values = s.sets.map((x) => x.rir).filter((x): x is number => x != null)
    return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length * 10) / 10 : null
  })
  const values = metric === 'load' ? tops : metric === 'reps' ? reps : rir

  return (
    <div className="screen">
      <button className="link back" onClick={onBack}>← Historial</button>
      <h2>{ex.name}</h2>
      {past === null && <p>Cargando…</p>}
      {past && past.length === 0 && <p className="muted">Sin sesiones registradas.</p>}
      {past && past.length > 0 && <section className="card history-chart-card">
        <h3>Evolución reciente</h3>
        <div className="subtabs history-metrics" aria-label="Métrica del gráfico">
          <button className={metric === 'load' ? 'active' : ''} onClick={() => setMetric('load')}>Carga</button>
          <button className={metric === 'reps' ? 'active' : ''} onClick={() => setMetric('reps')}>Reps</button>
          <button className={metric === 'rir' ? 'active' : ''} onClick={() => setMetric('rir')}>RIR</button>
        </div>
        <Spark values={values} metric={metric} sessions={chronological} loadType={ex.load_type} />
        <p className="muted history-chart-caption">Hasta {chronological.length} sesiones completadas · cada punto representa una sesión.</p>
      </section>}
      {past?.map((s) => (
        <section key={s.session_id} className="card">
          <p className="muted">{fmtDate(s.date)}</p>
          <p>{fmtSets(s.sets)}</p>
          {s.note && <p className="note">“{s.note}”</p>}
        </section>
      ))}
    </div>
  )
}

function Spark({ values, metric, sessions, loadType }: { values: (number | null)[]; metric: 'load' | 'reps' | 'rir'; sessions: PastSession[]; loadType: Exercise['load_type'] }) {
  const points = values.flatMap((value, index) => value == null ? [] : [{ value, index }])
  const v = points.map((point) => point.value)
  if (v.length === 0) return <p className="muted">Todavía no hay datos suficientes para esta métrica.</p>
  const min = Math.min(...v)
  const max = Math.max(...v)
  const w = 320, h = 112, pad = 12
  const xFor = (index: number) => pad + (sessions.length <= 1 ? w / 2 - pad : index / (sessions.length - 1) * (w - pad * 2))
  const yFor = (value: number) => h - pad - ((value - min) / (max - min || 1)) * (h - pad * 2)
  const pts = points.map((point) => `${xFor(point.index)},${yFor(point.value)}`).join(' ')
  const unit = metric === 'load' ? `kg${loadType === 'assistance' ? ' de asistencia' : ''}` : metric === 'reps' ? 'reps' : 'RIR'
  const label = metric === 'load' ? 'Carga máxima registrada' : metric === 'reps' ? 'Repeticiones máximas en una serie' : 'RIR medio de la sesión'
  const first = points[0].value, last = points[points.length - 1].value
  const suffix = metric === 'load' ? ' kg' : metric === 'reps' ? ' reps' : ''
  return (
    <div>
      <p className="history-chart-value">{last}{suffix}<small>{label}</small></p>
      <svg className="history-chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${label}: ${first}${suffix} a ${last}${suffix}`}>
        <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} className="history-chart-axis" />
        {points.length > 1 && <polyline points={pts} fill="none" className="history-chart-line" />}
        {points.map((point) => <circle key={point.index} cx={xFor(point.index)} cy={yFor(point.value)} r="4" className="history-chart-dot"><title>{sessions[point.index] ? fmtDate(sessions[point.index].date) : ''}: {point.value} {unit}</title></circle>)}
      </svg>
      <div className="history-chart-ends"><span>{first}{suffix}</span><span>{last}{suffix}</span></div>
    </div>
  )
}
