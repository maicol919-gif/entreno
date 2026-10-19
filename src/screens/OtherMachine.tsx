import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { toISODate } from '../lib/plan'
import { EFFORT_LEVELS, SEVERITY_LABEL, SPEECH_PHRASE, type Severity } from '../lib/treadmill'

type Speech = 'entera' | 'dos' | 'mitad'

const MACHINES = ['Bicicleta', 'Elíptica', 'Otra máquina']
const MINUTE_OPTIONS = [10, 15, 20, 25, 30]

interface Props {
  sessionId: string
  onBack: () => void
  onSaved: () => void
}

/** Cardio en una máquina que no es la cinta: se registra por minutos y esfuerzo, sin velocidades. */
export default function OtherMachine({ sessionId, onBack, onSaved }: Props) {
  const [machine, setMachine] = useState<string | null>(null)
  const [minutes, setMinutes] = useState<number>(20)
  const [speech, setSpeech] = useState<Speech | null>(null)
  const [effort, setEffort] = useState<number | null>(null)
  const [discomfort, setDiscomfort] = useState(false)
  const [severity, setSeverity] = useState<Severity | null>(null)
  const [note, setNote] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const savingRef = useRef(false)

  async function save() {
    if (savingRef.current || done) return
    if (!machine) return setErr('Elige la máquina.')
    if (!speech) return setErr('Elige cómo fue el test de habla.')
    if (discomfort && !severity) return setErr('Indica qué tan fuerte fue la molestia.')
    savingRef.current = true
    setSaving(true)
    setErr(null)
    const { error } = await supabase.from('cardio_logs').insert({
      session_id: sessionId,
      date: toISODate(new Date()),
      kind: 'otra',
      machine,
      minutes,
      rpe: effort,
      speech_test: speech,
      discomfort,
      discomfort_severity: discomfort ? severity : null,
      note: note || null,
    })
    setSaving(false)
    if (error && error.code !== '23505') {
      savingRef.current = false
      setErr(error.message)
      return
    }
    setDone(true)
    window.setTimeout(onSaved, 700)
  }

  return (
    <div className="screen">
      <button className="link back" onClick={onBack}>← Cardio en cinta</button>
      <h2>Cardio en otra máquina</h2>
      <p className="muted">Cuando la cinta está ocupada o hoy prefieres otra. Se guarda como cardio de la sesión, pero no cambia el nivel ni la fase de la cinta.</p>

      <section className="card">
        <h3>¿Qué máquina?</h3>
        <div className="levels">
          {MACHINES.map((m) => (
            <button key={m} className={`levelchip ${machine === m ? 'on' : ''}`} onClick={() => setMachine(m)}>
              <strong>{m}</strong>
            </button>
          ))}
        </div>
        <h3>¿Cuántos minutos?</h3>
        <div className="levels">
          {MINUTE_OPTIONS.map((m) => (
            <button key={m} className={`levelchip ${minutes === m ? 'on' : ''}`} onClick={() => setMinutes(m)}>
              <strong>{m} min</strong>
            </button>
          ))}
        </div>
        <label>
          Otro tiempo (min)
          <input type="number" min={1} max={120} value={minutes} onChange={(e) => setMinutes(Math.max(1, Math.min(120, Number(e.target.value) || 1)))} />
        </label>
      </section>

      <section className="card">
        <h3>Guía por sensación (opcional)</h3>
        <p className="muted">Calienta 5 min suave. Luego bloques de 1 min fuerte (frases cortas) y 1 min suave (hablas con normalidad), según el tiempo que tengas. Termina con 3-5 min suaves.</p>
      </section>

      <section className="card">
        <h3>Test de habla</h3>
        <p className="muted">Al final, di de corrido: <em>“{SPEECH_PHRASE}”</em></p>
        {(
          [
            ['entera', 'Entera, de un tirón'],
            ['dos', 'Partida en dos'],
            ['mitad', 'No pasé de la mitad'],
          ] as [Speech, string][]
        ).map(([k, label]) => (
          <button key={k} className={`choice ${speech === k ? 'on' : ''}`} onClick={() => setSpeech(k)}>{label}</button>
        ))}
      </section>

      <section className="card">
        <h3>¿Qué tan duro fue?</h3>
        {EFFORT_LEVELS.map((e) => (
          <button key={e.value} className={`choice ${effort === e.value ? 'on' : ''}`} onClick={() => setEffort(e.value)}>
            <strong>{e.label}</strong> <span className="muted">· {e.hint}</span>
          </button>
        ))}
      </section>

      <section className="card">
        <label className="check-row">
          <input type="checkbox" checked={discomfort} onChange={(e) => setDiscomfort(e.target.checked)} />
          <span>Molestia en rodilla / tobillo / tendón / articulaciones</span>
        </label>
        {discomfort && (
          <>
            <p className="muted">¿Qué tan fuerte fue?</p>
            <div className="levels">
              {(['leve', 'moderada', 'fuerte'] as Severity[]).map((sv) => (
                <button key={sv} className={`levelchip ${severity === sv ? 'on' : ''}`} onClick={() => setSeverity(sv)}>
                  <strong>{SEVERITY_LABEL[sv]}</strong>
                </button>
              ))}
            </div>
          </>
        )}
        <label>Nota<textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></label>
        {err && <p className="err">{err}</p>}
        <button className="primary" onClick={save} disabled={saving || done}>{done ? 'Guardado ✓' : saving ? 'Guardando…' : 'Guardar cardio'}</button>
      </section>
    </div>
  )
}
