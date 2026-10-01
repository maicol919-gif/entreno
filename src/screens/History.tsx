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
  useEffect(() => {
    void loadPast(ex.id).then(setPast)
  }, [ex.id])

  const tops = (past ?? []).slice().reverse().map((s) => {
    const loads = s.sets.map((x) => totalLoad(x.load_kg, ex.load_type, ex.bar_kg)).filter((x): x is number => x != null)
    return loads.length ? (ex.load_type === 'assistance' ? Math.min(...loads) : Math.max(...loads)) : null
  })

  return (
    <div className="screen">
      <button className="link back" onClick={onBack}>← Historial</button>
      <h2>{ex.name}</h2>
      {past === null && <p>Cargando…</p>}
      {past && past.length === 0 && <p className="muted">Sin sesiones registradas.</p>}
      {past && past.length > 1 && <Spark values={tops} better={ex.load_type === 'assistance' ? 'low' : 'high'} />}
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

function Spark({ values, better }: { values: (number | null)[]; better: 'high' | 'low' }) {
  const v = values.filter((x): x is number => x != null)
  if (v.length < 2) return null
  const min = Math.min(...v)
  const max = Math.max(...v)
  const w = 300
  const h = 60
  const pts = v.map((y, i) => `${(i / (v.length - 1)) * w},${h - ((y - min) / (max - min || 1)) * (h - 8) - 4}`).join(' ')
  const improved = better === 'high' ? v[v.length - 1] >= v[0] : v[v.length - 1] <= v[0]
  return (
    <section className="card">
      <p className="muted">Carga máxima por sesión ({v[0]} → {v[v.length - 1]} kg) {improved ? '↑ mejora' : '↓'}</p>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="60" role="img" aria-label="Tendencia de carga">
        <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    </section>
  )
}
