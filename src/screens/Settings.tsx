import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../store'

const SOUND_KEY = 'entreno.sound.enabled'

export default function SettingsTab() {
  const { settings, reload } = useData()
  const [offset, setOffset] = useState(String(settings.week_offset ?? 0))
  const [sound, setSound] = useState(() => localStorage.getItem(SOUND_KEY) !== 'false')
  const [msg, setMsg] = useState<string | null>(null)

  async function saveCycle() {
    const next = Math.round(Number(offset) || 0)
    const confirmed = window.confirm(`Vista previa del cambio\n\nAjuste actual: ${settings.week_offset ?? 0}\nNuevo ajuste: ${next}\n\n¿Guardar la corrección del ciclo?`)
    if (!confirmed) return
    const { error } = await supabase.from('settings').upsert({ mesocycle_start: settings.mesocycle_start, rest_seconds: settings.rest_seconds, week_offset: next })
    setMsg(error ? `No se pudo guardar: ${error.message}` : 'Corrección del ciclo guardada.')
    await reload()
  }

  function toggleSound(value: boolean) {
    setSound(value)
    localStorage.setItem(SOUND_KEY, String(value))
    setMsg(value ? 'Avisos sonoros activados en este dispositivo.' : 'Avisos sonoros desactivados en este dispositivo.')
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
    URL.revokeObjectURL(a.href)
  }

  async function forceUpdate() {
    try {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
      for (const k of await caches.keys()) await caches.delete(k)
    } catch { /* sin service worker: basta con recargar */ }
    location.reload()
  }

  return (
    <div className="screen">
      <h2>Ajustes</h2>
      {msg && <p className={msg.startsWith('No se pudo') ? 'err' : 'ok'} role="status">{msg}</p>}
      <section className="card">
        <h3>Ciclo de entrenamiento</h3>
        <p className="muted">La semana avanza al completar el Día 5. La corrección solo cambia el cálculo de la semana y no modifica sesiones ni cargas.</p>
        <label>Ajuste de semana (0 = automático; +1 adelanta, −1 retrasa)<input inputMode="numeric" value={offset} onChange={(e) => setOffset(e.target.value)} /></label>
        <p className="fixed">Vista previa: ajuste {settings.week_offset ?? 0} → {Math.round(Number(offset) || 0)}.</p>
        <button className="primary" onClick={saveCycle}>Revisar y guardar</button>
      </section>
      <section className="card">
        <h3>Avisos sonoros</h3>
        <label className="check-row"><input type="checkbox" checked={sound} onChange={(e) => toggleSound(e.target.checked)} /><span>Sonido al cambiar tramo de cardio y al terminar el descanso</span></label>
      </section>
      <section className="card"><h3>Datos</h3><button onClick={exportAll}>Descargar respaldo</button></section>
      <section className="card">
        <h3>Versión de la app</h3><p>Versión <strong>{__VERSION__}</strong></p><p className="muted">Compilada: {__BUILD__}</p>
        <button onClick={forceUpdate}>Buscar actualización</button>
      </section>
      <button className="link" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
    </div>
  )
}
