import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../store'
import { toISODate } from '../lib/plan'
import { lastDate, paceVerdict, trend, waistGoalCm, whtr, whtrZone, windowMean, type BodyPoint, type PaceVerdict } from '../lib/body'

const PACE_TEXT: Record<PaceVerdict, string> = {
  'sin-datos': 'Hacen falta al menos dos semanas de peso para juzgar el ritmo.',
  rapido: 'Bajas más de 1 % por semana: es demasiado rápido y arriesgas músculo. Sube unas 150 kcal.',
  bien: 'Ritmo correcto (0,3-1 % por semana). Mantén el plan.',
  lento: 'Casi sin cambio. Si se repite dos semanas, baja 100-150 kcal o suma pasos.',
  sube: 'El peso sube. Revisa porciones y pasos; si se repite dos semanas, baja 100-150 kcal.',
}

function daysSince(date: string): number {
  return Math.round((Date.now() - new Date(date + 'T00:00:00').getTime()) / 86400000)
}

function fmt(n: number, d = 1): string {
  return n.toFixed(d).replace('.', ',')
}

function signed(n: number, d = 1): string {
  return (n > 0 ? '+' : '') + fmt(n, d)
}

function LineChart({ points, unit }: { points: { date: string; v: number }[]; unit: string }) {
  if (points.length < 2) return <p className="muted">Con dos registros aparece la gráfica.</p>
  const W = 320
  const H = 110
  const pad = 6
  const vs = points.map((p) => p.v)
  const lo = Math.min(...vs)
  const hi = Math.max(...vs)
  const span = hi - lo || 1
  const t0 = new Date(points[0].date + 'T00:00:00Z').getTime()
  const t1 = new Date(points[points.length - 1].date + 'T00:00:00Z').getTime()
  const x = (d: string) => pad + ((new Date(d + 'T00:00:00Z').getTime() - t0) / (t1 - t0 || 1)) * (W - pad * 2)
  const y = (v: number) => H - pad - ((v - lo) / span) * (H - pad * 2)
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Evolución en ${unit}`}>
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
        {points.map((p) => <circle key={p.date} cx={x(p.date)} cy={y(p.v)} r="2.5" fill="var(--accent)" />)}
      </svg>
      <div className="row between muted">
        <span>{points[0].date.slice(5)}: {fmt(points[0].v)} {unit}</span>
        <span>{points[points.length - 1].date.slice(5)}: {fmt(points[points.length - 1].v)} {unit}</span>
      </div>
    </div>
  )
}

export default function Body() {
  const { settings, reload } = useData()
  const [list, setList] = useState<BodyPoint[]>([])
  const [loaded, setLoaded] = useState(false)
  const [date, setDate] = useState(toISODate(new Date()))
  const [kg, setKg] = useState('')
  const [waist, setWaist] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [height, setHeight] = useState(String(settings.height_cm))
  const [kcal, setKcal] = useState(String(settings.kcal_target))
  const [protein, setProtein] = useState(String(settings.protein_target))

  async function load() {
    const { data, error } = await supabase
      .from('body_weight')
      .select('date,kg,waist_cm')
      .order('date', { ascending: true })
      .limit(400)
    if (error) setMsg(error.message)
    setList(((data ?? []) as BodyPoint[]).map((r) => ({ date: r.date, kg: r.kg == null ? null : Number(r.kg), waist_cm: r.waist_cm == null ? null : Number(r.waist_cm) })))
    setLoaded(true)
  }
  useEffect(() => {
    void load()
  }, [])

  async function save() {
    const w = Number(kg.replace(',', '.'))
    const c = Number(waist.replace(',', '.'))
    if (!w && !c) {
      setMsg('Escribe el peso, la cintura o los dos.')
      return
    }
    if (w && (w < 30 || w > 250)) return setMsg('El peso debe estar entre 30 y 250 kg.')
    if (c && (c < 40 || c > 200)) return setMsg('La cintura debe estar entre 40 y 200 cm.')
    const row: Record<string, unknown> = { date }
    if (w) row.kg = w
    if (c) row.waist_cm = c
    const { error } = await supabase.from('body_weight').upsert(row)
    setMsg(error ? error.message : 'Guardado.')
    if (!error) {
      setKg('')
      setWaist('')
      await load()
    }
  }

  async function saveGoals() {
    const h = Number(height.replace(',', '.'))
    const k = Math.round(Number(kcal))
    const p = Math.round(Number(protein))
    if (!h || h < 120 || h > 230 || !k || k < 1200 || k > 5000 || !p || p < 40 || p > 400) {
      setMsg('Revisa la altura, las calorías y la proteína.')
      return
    }
    const { error } = await supabase.from('settings').upsert({ height_cm: h, kcal_target: k, protein_target: p })
    setMsg(error ? error.message : 'Metas guardadas.')
    await reload()
  }

  const h = settings.height_cm
  const lastWaistDate = lastDate(list, 'waist_cm')
  const lastWaist = lastWaistDate ? list.find((x) => x.date === lastWaistDate)?.waist_cm ?? null : null
  const waistAvg = lastWaistDate ? windowMean(list, 'waist_cm', lastWaistDate) : null
  const waistTrend = useMemo(() => trend(list, 'waist_cm'), [list])
  const weightTrend = useMemo(() => trend(list, 'kg'), [list])
  const ratio = lastWaist != null ? whtr(lastWaist, h) : null
  const zone = ratio != null ? whtrZone(ratio) : null
  const goal = waistGoalCm(h)
  const waistStale = lastWaistDate == null || daysSince(lastWaistDate) >= 7
  const weightPoints = list.filter((x) => x.kg != null).slice(-60).map((x) => ({ date: x.date, v: x.kg as number }))
  const waistPoints = list.filter((x) => x.waist_cm != null).slice(-30).map((x) => ({ date: x.date, v: x.waist_cm as number }))

  return (
    <div className="screen">
      <h2>Cuerpo</h2>
      <p className="muted">Objetivo: bajar la grasa abdominal. La cintura es el indicador; el peso acompaña.</p>
      {msg && <p className={msg.startsWith('Guardado') || msg.startsWith('Metas') ? 'ok' : 'err'}>{msg}</p>}

      <section className="card">
        <h3>Registrar medidas</h3>
        <p className="muted">Cintura: cinta a la altura del ombligo, de pie, en ayunas y después de soltar el aire. Una vez por semana.</p>
        <label>Fecha<input type="date" value={date} max={toISODate(new Date())} onChange={(e) => setDate(e.target.value)} /></label>
        <div className="row">
          <label style={{ flex: 1 }}>Peso (kg)<input inputMode="decimal" placeholder="opcional" value={kg} onChange={(e) => setKg(e.target.value)} /></label>
          <label style={{ flex: 1 }}>Cintura (cm)<input inputMode="decimal" placeholder="opcional" value={waist} onChange={(e) => setWaist(e.target.value)} /></label>
        </div>
        <button className="primary" onClick={save}>Guardar</button>
      </section>

      <section className="card">
        <h3>Cintura</h3>
        {waistStale && loaded && (
          <p className="warn-text">{lastWaistDate ? `Hace ${daysSince(lastWaistDate)} días que no mides la cintura.` : 'Aún no has registrado la cintura.'} Toca medirla.</p>
        )}
        {lastWaist != null && ratio != null && zone && (
          <>
            <p>
              Última: <strong>{fmt(lastWaist)} cm</strong> <span className="muted">({lastWaistDate})</span>
            </p>
            <p>
              Cintura/altura: <strong className={zone === 'ok' ? 'ok' : zone === 'limite' ? 'warn-text' : 'err'}>{fmt(ratio, 3)}</strong>
              <span className="muted"> · meta &lt; 0,5 (≤ {goal} cm con {fmt(h, 0)} cm de altura)</span>
            </p>
            {waistAvg != null && waistTrend?.delta != null && (
              <p className="muted">Media 7 días: {fmt(waistAvg)} cm ({signed(waistTrend.delta)} cm vs. semana anterior)</p>
            )}
            <p className="muted">Faltan {lastWaist > goal ? fmt(lastWaist - goal) : '0'} cm para la meta de {goal} cm.</p>
          </>
        )}
        <LineChart points={waistPoints} unit="cm" />
      </section>

      <section className="card">
        <h3>Peso</h3>
        {weightTrend ? (
          <>
            <p>
              Media 7 días: <strong>{fmt(weightTrend.current)} kg</strong>
              {weightTrend.delta != null && <span className="muted"> ({signed(weightTrend.delta, 2)} kg vs. semana anterior{weightTrend.pct != null ? `, ${signed(weightTrend.pct, 1)} %` : ''})</span>}
            </p>
            <p className="muted">{PACE_TEXT[paceVerdict(weightTrend)]}</p>
          </>
        ) : (
          <p className="muted">Aún no hay peso registrado.</p>
        )}
        <LineChart points={weightPoints} unit="kg" />
      </section>

      <section className="card">
        <h3>Metas diarias</h3>
        <label>Altura (cm)<input inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} /></label>
        <label>Calorías (kcal)<input inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value)} /></label>
        <label>Proteína (g)<input inputMode="numeric" value={protein} onChange={(e) => setProtein(e.target.value)} /></label>
        <button onClick={saveGoals}>Guardar metas</button>
      </section>
    </div>
  )
}
