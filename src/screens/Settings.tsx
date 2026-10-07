import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../store'

export default function SettingsTab() {
  const { settings, exercises, reload } = useData()
  const [offset, setOffset] = useState(String(settings.week_offset ?? 0))
  const [rest, setRest] = useState(String(settings.rest_seconds))
  const [msg, setMsg] = useState<string | null>(null)

  async function saveSettings() {
    const { error } = await supabase.from('settings').upsert({ mesocycle_start: settings.mesocycle_start, rest_seconds: Number(rest) || 120, week_offset: Math.round(Number(offset)) || 0 })
    setMsg(error ? error.message : 'Guardado.')
    await reload()
  }

  async function exportAll() {
    const tables = ['exercises', 'routine_days', 'routine_items', 'sessions', 'sets', 'session_exercise_notes', 'cardio_logs', 'body_weight', 'settings']
    const out: Record<string, unknown> = {}
    for (const t of tables) out[t] = (await supabase.from(t).select('*')).data
    const blob = new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `entreno-respaldo-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
  }

  async function setBar(id: string, v: number) {
    await supabase.from('exercises').update({ bar_kg: v }).eq('id', id)
    await reload()
  }

  async function forceUpdate() {
    try {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
      for (const k of await caches.keys()) await caches.delete(k)
    } catch {
      /* sin service worker: basta con recargar */
    }
    location.reload()
  }

  const barEx = exercises.filter((e) => e.load_type === 'plates_per_side_plus_bar')

  return (
    <div className="screen">
      <h2>Ajustes</h2>
      {msg && <p className="ok">{msg}</p>}

      <section className="card">
        <h3>Ciclo de entrenamiento</h3>
        <p className="muted">La semana del ciclo avanza sola cada vez que haces el Día 5 (no depende del calendario).</p>
        <label>Ajuste de semana (0 = automático; +1 adelanta, −1 retrasa)<input inputMode="numeric" value={offset} onChange={(e) => setOffset(e.target.value)} /></label>
        <label>Descanso entre series (segundos)<input inputMode="numeric" value={rest} onChange={(e) => setRest(e.target.value)} /></label>
        <button onClick={saveSettings}>Guardar</button>
      </section>

      <section className="card">
        <h3>Peso de la barra</h3>
        <p className="muted">Para ejercicios donde anotas discos por lado (Smith, barra). Sirve para comparar cargas totales.</p>
        {barEx.map((e) => (
          <label key={e.id}>{e.name}
            <input inputMode="decimal" defaultValue={e.bar_kg} onBlur={(ev) => setBar(e.id, Number(ev.target.value.replace(',', '.')) || 0)} />
          </label>
        ))}
      </section>

      <section className="card">
        <h3>Datos</h3>
        <button onClick={exportAll}>Descargar respaldo</button>
      </section>

      <section className="card">
        <h3>Versión de la app</h3>
        <p>Versión <strong>{__VERSION__}</strong></p>
        <p className="muted">Compilada: {__BUILD__}</p>
        <button onClick={forceUpdate}>Buscar actualización</button>
      </section>

      <button className="link" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
    </div>
  )
}
