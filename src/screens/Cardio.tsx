import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmtDate } from '../lib/history'
import { toISODate, type CardioPlan } from '../lib/plan'
import {
  SPEECH_PHRASE,
  intervalSession,
  intervalWarnings,
  locate,
  nextInterval,
  recoveryWalk,
  totalSeconds,
  type IntervalConfig,
  type LastInterval,
  type PastCardio,
  type Segment,
  type SpeechTest,
} from '../lib/treadmill'
import { beep, useRest } from '../rest'

const KEY = 'entreno.cardio.run'
type Mode = 'intervalos' | 'recuperacion'

interface Run {
  start: number
  mode: Mode
  cfg: IntervalConfig
}

interface LogRow extends PastCardio {
  minutes: number
  speech_test: SpeechTest | null
  discomfort: boolean
  protocol: Partial<IntervalConfig> | null
}

function readRun(): Run | null {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Run | null
    return r && Date.now() - r.start < 3 * 3600 * 1000 ? r : null
  } catch {
    return null
  }
}

function writeRun(r: Run | null) {
  try {
    if (r) localStorage.setItem(KEY, JSON.stringify(r))
    else localStorage.removeItem(KEY)
  } catch {
    /* el cronómetro sigue en memoria */
  }
}

function sevenDaysAgo(): string {
  return toISODate(new Date(Date.now() - 6 * 86400000))
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

interface Props {
  plan: CardioPlan
  sessionId: string
  onBack: () => void
}

export default function Cardio({ plan, sessionId, onBack }: Props) {
  const { clear: clearRest } = useRest()
  const saved = useRef(readRun())
  const [logs, setLogs] = useState<LogRow[] | null>(null)
  const [mode, setMode] = useState<Mode>(saved.current?.mode ?? plan.kind)
  const [override, setOverride] = useState(false)
  const [run, setRun] = useState<Run | null>(saved.current)
  const [now, setNow] = useState(() => Date.now())
  const [phase, setPhase] = useState<'plan' | 'form'>('plan')
  const [stoppedAt, setStoppedAt] = useState<number | null>(null)
  const [speech, setSpeech] = useState<SpeechTest | null>(null)
  const [rpe, setRpe] = useState('')
  const [discomfort, setDiscomfort] = useState(false)
  const [note, setNote] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [showTable, setShowTable] = useState(false)
  const lastIndex = useRef(-1)

  const today = toISODate(new Date())

  useEffect(() => {
    void supabase
      .from('cardio_logs')
      .select('date,kind,minutes,speech_test,discomfort,protocol')
      .gte('date', toISODate(new Date(Date.now() - 60 * 86400000)))
      .order('date', { ascending: false })
      .then(({ data }) => setLogs((data ?? []) as LogRow[]))
  }, [])

  const lastInterval: LastInterval | null = useMemo(() => {
    const l = logs?.find((x) => x.kind === 'intervalos')
    return l ? { protocol: l.protocol, speech_test: l.speech_test, discomfort: l.discomfort } : null
  }, [logs])

  const next = useMemo(() => nextInterval(lastInterval), [lastInterval])
  const warnings = useMemo(() => intervalWarnings(logs ?? [], today, sevenDaysAgo()), [logs, today])
  const recommendSoft = plan.kind === 'intervalos' && (warnings.length > 0 || next.suggestSoft)

  // si hay una advertencia, el modo recomendado cambia a caminata suave (salvo que elijas lo contrario)
  useEffect(() => {
    if (logs && !run && !override && recommendSoft) setMode('recuperacion')
  }, [logs, run, override, recommendSoft])

  const cfg: IntervalConfig = run?.cfg ?? next.config
  const segs: Segment[] = useMemo(() => (mode === 'intervalos' ? intervalSession(cfg) : recoveryWalk()), [mode, cfg])
  const total = totalSeconds(segs)

  const elapsed = run ? Math.max(0, Math.floor((now - run.start) / 1000)) : 0
  const pos = run ? locate(segs, elapsed) : null
  const finished = run != null && pos == null

  useEffect(() => {
    if (!run || finished) return
    const t = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(t)
  }, [run, finished])

  // aviso al cambiar de segmento
  useEffect(() => {
    if (!run) return
    const idx = pos ? pos.index : segs.length
    if (idx !== lastIndex.current) {
      if (lastIndex.current !== -1) {
        navigator.vibrate?.(idx >= segs.length ? [300, 150, 300, 150, 300] : segs[idx].kind === 'fast' ? [200, 100, 200] : [200])
        beep()
      }
      lastIndex.current = idx
    }
  }, [run, pos, segs])

  // mantener la pantalla encendida mientras corre
  useEffect(() => {
    if (!run || finished) return
    let lock: { release: () => Promise<void> } | null = null
    const nav = navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
    void nav.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => undefined)
    return () => {
      void lock?.release()
    }
  }, [run, finished])

  useEffect(() => {
    if (finished) setPhase('form')
  }, [finished])

  function begin() {
    clearRest()
    lastIndex.current = -1
    const r: Run = { start: Date.now(), mode, cfg }
    setNow(r.start)
    setRun(r)
    writeRun(r)
  }

  function stop() {
    setStoppedAt(Date.now())
    setPhase('form')
  }

  function discard() {
    writeRun(null)
    setRun(null)
    setStoppedAt(null)
    setPhase('plan')
  }

  const workedSec = run ? Math.min(total, Math.floor(((stoppedAt ?? now) - run.start) / 1000)) : 0
  const completed = run != null && (finished || workedSec >= total)

  async function save() {
    if (!run) return
    if (mode === 'intervalos' && completed && !speech) {
      setErr('Haz el test de habla y elige el resultado.')
      return
    }
    const { error } = await supabase.from('cardio_logs').insert({
      session_id: sessionId,
      date: today,
      kind: mode,
      machine: 'Trotadora',
      minutes: Math.max(1, Math.round((workedSec / 60) * 10) / 10),
      rpe: rpe ? Number(rpe) : null,
      speech_test: mode === 'intervalos' && completed ? speech : null,
      discomfort,
      protocol: mode === 'intervalos' ? run.cfg : null,
      note: note || null,
    })
    if (error) {
      setErr(error.message)
      return
    }
    writeRun(null)
    setDone(true)
    window.setTimeout(onBack, 700)
  }

  const lastSame = logs?.find((l) => l.kind === mode)

  // ───────── pantalla de ejecución guiada ─────────
  if (run && phase === 'plan' && pos) {
    const seg = segs[pos.index]
    const upcoming = segs[pos.index + 1]
    return (
      <div className="screen">
        <div className={`runcard ${seg.kind}`}>
          <p className="runlabel">{seg.label}</p>
          <p className="runspeed">{seg.speed.toFixed(1)} <small>km/h</small></p>
          <p className="runincline">Inclinación {seg.incline} %</p>
          <p className="runleft">{fmt(pos.left)}</p>
        </div>
        <p className="muted center-text">
          {upcoming ? `Siguiente: ${upcoming.speed.toFixed(1)} km/h · ${upcoming.incline} % (${upcoming.label})` : 'Último tramo'}
        </p>
        <div className="progress"><div style={{ width: `${Math.min(100, (elapsed / total) * 100)}%` }} /></div>
        <p className="muted center-text">{fmt(elapsed)} / {fmt(total)}</p>
        {mode === 'intervalos' && <p className="muted center-text">No te agarres de la barra. No recortes el enfriamiento.</p>}
        <button onClick={stop}>Terminar antes</button>
      </div>
    )
  }

  // ───────── formulario final ─────────
  if (run && phase === 'form') {
    return (
      <div className="screen">
        <h2>{completed ? 'Sesión completa' : 'Sesión parcial'}</h2>
        <p className="muted">Tiempo: {fmt(workedSec)}</p>

        {mode === 'intervalos' && completed && (
          <section className="card">
            <h3>Test de habla</h3>
            <p className="muted">Al final de la última recuperación, di de corrido: <em>“{SPEECH_PHRASE}”</em></p>
            {(
              [
                ['entera', 'Entera, de un tirón'],
                ['dos', 'Partida en dos'],
                ['mitad', 'No pasé de la mitad'],
              ] as [SpeechTest, string][]
            ).map(([k, label]) => (
              <button key={k} className={`choice ${speech === k ? 'on' : ''}`} onClick={() => setSpeech(k)}>{label}</button>
            ))}
          </section>
        )}

        <section className="card">
          <label>Esfuerzo percibido (1-10)
            <select value={rpe} onChange={(e) => setRpe(e.target.value)}>
              <option value="">—</option>
              {Array.from({ length: 10 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
            </select>
          </label>
          <label className="check-row">
            <input type="checkbox" checked={discomfort} onChange={(e) => setDiscomfort(e.target.checked)} />
            <span>Molestia en tobillo / tendón / articulaciones</span>
          </label>
          <label>Nota<textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></label>
          {err && <p className="err">{err}</p>}
          <button className="primary" onClick={save} disabled={done}>{done ? 'Guardado ✓' : 'Guardar cardio'}</button>
          <button className="link" onClick={discard}>Descartar</button>
        </section>
      </div>
    )
  }

  // ───────── pantalla del plan ─────────
  const minutes = Math.round(total / 60 * 10) / 10
  let t = 0
  return (
    <div className="screen">
      <button className="link back" onClick={onBack}>← Sesión</button>
      <h2>Cardio en cinta</h2>
      <p>{mode === 'intervalos' ? 'Intervalos' : 'Caminata suave en cuesta'} · {minutes} min{plan.optional && mode === 'recuperacion' ? ' · opcional' : ''}</p>

      {logs === null && <p className="muted">Cargando…</p>}

      {warnings.map((w) => <p key={w} className="fixed">⚠ {w}</p>)}
      {mode === 'intervalos' && <p className="fixed">📌 {next.message}</p>}
      {mode === 'recuperacion' && <p className="muted">Frases completas todo el rato. Si las piernas están muy cargadas, baja la inclinación.</p>}

      {plan.kind === 'intervalos' && (
        <div className="row">
          {mode === 'intervalos' ? (
            <button className="link" onClick={() => { setOverride(true); setMode('recuperacion') }}>Prefiero caminata suave hoy</button>
          ) : (
            <button className="link" onClick={() => { setOverride(true); setMode('intervalos') }}>Hacer intervalos igualmente</button>
          )}
        </div>
      )}

      <section className="card last">
        <h3>Última vez</h3>
        {lastSame ? (
          <p>{fmtDate(lastSame.date)}: {lastSame.minutes} min{lastSame.speech_test ? ` · habla: ${lastSame.speech_test === 'entera' ? 'entera' : lastSame.speech_test === 'dos' ? 'en dos' : 'no pasó de la mitad'}` : ''}{lastSame.discomfort ? ' · con molestia' : ''}</p>
        ) : (
          <p className="muted">Primera vez registrada en la app.</p>
        )}
      </section>

      <section className="card">
        <div className="row between">
          <h3>Tramos</h3>
          <button className="link" onClick={() => setShowTable((v) => !v)}>{showTable ? 'Ocultar' : 'Ver'}</button>
        </div>
        {showTable && (
          <table className="segtable">
            <tbody>
              {segs.map((s, i) => {
                const from = t
                t += s.sec
                return (
                  <tr key={i} className={s.kind}>
                    <td>{fmt(from)}–{fmt(t)}</td>
                    <td>{s.speed.toFixed(1)} km/h</td>
                    <td>{s.incline} %</td>
                    <td>{s.label}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        <button className="primary" onClick={begin} disabled={logs === null}>Empezar guiado</button>
        <p className="muted center-text">Vibra y suena en cada cambio de tramo. Mantiene la pantalla encendida.</p>
      </section>
    </div>
  )
}
