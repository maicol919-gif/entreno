import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmtDate } from '../lib/history'
import { toISODate, type CardioPlan } from '../lib/plan'
import { readRun, writeRun, type Run } from '../lib/cardioRun'
import {
  EFFORT_LEVELS,
  SPEECH_PHRASE,
  cardioChoice,
  intervalSession,
  intervalWarnings,
  legHints,
  locate,
  nextInterval,
  recoveryWalk,
  totalSeconds,
  type LastInterval,
  type LegContext,
  type LegsFeel,
  type PastCardio,
  type Segment,
  type SpeechTest,
} from '../lib/treadmill'
import { beep, useRest } from '../rest'

type Mode = 'intervalos' | 'recuperacion'

interface LogRow extends PastCardio {
  minutes: number
  speech_test: SpeechTest | null
  discomfort: boolean
  protocol: Partial<LastInterval['protocol']> | null
}

function sevenDaysAgo(): string {
  return toISODate(new Date(Date.now() - 6 * 86400000))
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

const FEEL_OPTIONS: { value: LegsFeel; label: string; hint: string }[] = [
  { value: 'frescas', label: 'Frescas', hint: 'sin molestia, con ganas' },
  { value: 'normales', label: 'Normales', hint: 'algo de cansancio, nada raro' },
  { value: 'cargadas', label: 'Cargadas', hint: 'agujetas o pesadez' },
]

interface Props {
  plan: CardioPlan
  sessionId: string
  legCtx: LegContext
  onBack: () => void
}

export default function Cardio({ plan, sessionId, legCtx, onBack }: Props) {
  const { clear: clearRest } = useRest()
  const saved = useRef(readRun())
  const [logs, setLogs] = useState<LogRow[] | null>(null)
  const [feel, setFeel] = useState<LegsFeel | null>(saved.current?.feel ?? null)
  const [mode, setMode] = useState<Mode>(saved.current?.mode ?? plan.kind)
  const [reducedChoice, setReducedChoice] = useState<boolean | null>(null)
  const [run, setRun] = useState<Run | null>(saved.current)
  const [now, setNow] = useState(() => Date.now())
  const [phase, setPhase] = useState<'plan' | 'form'>('plan')
  const [stoppedAt, setStoppedAt] = useState<number | null>(null)
  const [speech, setSpeech] = useState<SpeechTest | null>(null)
  const [effort, setEffort] = useState<number | null>(null)
  const [discomfort, setDiscomfort] = useState(false)
  const [note, setNote] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [showTable, setShowTable] = useState(false)
  const lastIndex = useRef(-1)
  const savingRef = useRef(false)

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
    return l ? { protocol: l.protocol ?? null, speech_test: l.speech_test, discomfort: l.discomfort } : null
  }, [logs])

  const next = useMemo(() => nextInterval(lastInterval), [lastInterval])
  const warnings = useMemo(() => intervalWarnings(logs ?? [], today, sevenDaysAgo()), [logs, today])
  const hints = useMemo(() => legHints(legCtx), [legCtx])

  // al elegir cómo están las piernas se decide el tipo de cardio (aún puedes cambiarlo a mano)
  const choice = feel ? cardioChoice(plan.kind, feel) : null
  useEffect(() => {
    if (!run && choice) setMode(warnings.length > 0 && choice.mode === 'intervalos' ? 'recuperacion' : choice.mode)
  }, [run, choice, warnings.length])

  const reduced = run?.reduced ?? reducedChoice ?? choice?.reduced ?? false
  const cfg = run?.cfg ?? next.config
  const segs: Segment[] = useMemo(() => (mode === 'intervalos' ? intervalSession(cfg) : recoveryWalk(reduced)), [mode, cfg, reduced])
  const total = totalSeconds(segs)

  const elapsed = run ? Math.max(0, Math.floor((now - run.start) / 1000)) : 0
  const pos = run ? locate(segs, elapsed) : null
  const finished = run != null && pos == null

  useEffect(() => {
    if (!run || finished) return
    const t = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(t)
  }, [run, finished])

  // aviso al cambiar de tramo
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

  // el cardio termina cuando el reloj lo dice, esté o no abierta la pantalla
  useEffect(() => {
    if (finished) setPhase('form')
  }, [finished])

  function begin() {
    if (!feel) return
    clearRest()
    lastIndex.current = -1
    const r: Run = { start: Date.now(), mode, cfg, reduced, sessionId, feel }
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
    if (!run || savingRef.current || done) return
    if (mode === 'intervalos' && completed && !speech) {
      setErr('Haz el test de habla y elige el resultado.')
      return
    }
    savingRef.current = true
    setSaving(true)
    setErr(null)
    const { error } = await supabase.from('cardio_logs').insert({
      session_id: run.sessionId,
      date: toISODate(new Date(run.start)),
      kind: mode,
      machine: 'Trotadora',
      minutes: Math.max(1, Math.round((workedSec / 60) * 10) / 10),
      rpe: effort,
      speech_test: mode === 'intervalos' && completed ? speech : null,
      discomfort,
      protocol: mode === 'intervalos' ? run.cfg : null,
      legs_feel: run.feel,
      note: note || null,
    })
    setSaving(false)
    // 23505 = ya estaba guardado (doble toque): se trata como guardado
    if (error && error.code !== '23505') {
      savingRef.current = false
      setErr(error.message)
      return
    }
    writeRun(null)
    setDone(true)
    window.setTimeout(onBack, 700)
  }

  const lastSame = logs?.find((l) => l.kind === mode)

  // ───────── ejecución guiada ─────────
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
        <h2>{completed ? 'Cardio completo' : 'Cardio parcial'}</h2>
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
          <h3>¿Qué tan duro fue?</h3>
          <p className="muted">Es el esfuerzo que sentiste, no cómo quedaron las piernas.</p>
          {EFFORT_LEVELS.map((e) => (
            <button key={e.value} className={`choice ${effort === e.value ? 'on' : ''}`} onClick={() => setEffort(e.value)}>
              <strong>{e.label}</strong> <span className="muted">· {e.hint}</span>
            </button>
          ))}
        </section>

        <section className="card">
          <label className="check-row">
            <input type="checkbox" checked={discomfort} onChange={(e) => setDiscomfort(e.target.checked)} />
            <span>Molestia en tobillo / tendón / articulaciones</span>
          </label>
          <label>Nota<textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></label>
          {err && <p className="err">{err}</p>}
          <button className="primary" onClick={save} disabled={saving || done}>{done ? 'Guardado ✓' : saving ? 'Guardando…' : 'Guardar cardio'}</button>
          <button className="link" onClick={discard} disabled={saving || done}>Descartar</button>
        </section>
      </div>
    )
  }

  // ───────── plan del día ─────────
  const minutes = Math.round((total / 60) * 10) / 10
  let t = 0
  return (
    <div className="screen">
      <button className="link back" onClick={onBack}>← Sesión</button>
      <h2>Cardio en cinta</h2>

      {!feel && (
        <section className="card">
          <h3>¿Cómo sientes las piernas hoy?</h3>
          {hints.map((h) => <p key={h} className="muted">{h}</p>)}
          {FEEL_OPTIONS.map((o) => (
            <button key={o.value} className="choice" onClick={() => setFeel(o.value)}>
              <strong>{o.label}</strong> <span className="muted">· {o.hint}</span>
            </button>
          ))}
        </section>
      )}

      {feel && (
        <>
          <p>
            {mode === 'intervalos' ? 'Intervalos' : 'Caminata suave en cuesta'} · {minutes} min
            {plan.optional && mode === 'recuperacion' ? ' · opcional' : ''}
          </p>
          <p className="muted">
            Piernas {feel}.{' '}
            <button className="link" onClick={() => setFeel(null)}>Cambiar</button>
          </p>

          {logs === null && <p className="muted">Cargando…</p>}
          {warnings.map((w) => <p key={w} className="fixed">⚠ {w}</p>)}
          {mode === 'intervalos' && <p className="fixed">📌 {next.message}</p>}
          {mode === 'recuperacion' && (
            <>
              <p className="muted">Frases completas todo el rato.</p>
              <label className="check-row">
                <input type="checkbox" checked={reduced} onChange={(e) => setReducedChoice(e.target.checked)} />
                <span>Piernas cargadas: inclinación máx. 2 % y velocidad máx. 5,0 km/h</span>
              </label>
            </>
          )}

          {plan.kind === 'intervalos' && (
            <div className="row">
              {mode === 'intervalos' ? (
                <button className="link" onClick={() => setMode('recuperacion')}>Prefiero caminata suave hoy</button>
              ) : (
                <button className="link" onClick={() => setMode('intervalos')}>Hacer intervalos igualmente</button>
              )}
            </div>
          )}

          <section className="card last">
            <h3>Última vez</h3>
            {lastSame ? (
              <p>
                {fmtDate(lastSame.date)}: {lastSame.minutes} min
                {lastSame.speech_test ? ` · habla: ${lastSame.speech_test === 'entera' ? 'entera' : lastSame.speech_test === 'dos' ? 'en dos' : 'no pasó de la mitad'}` : ''}
                {lastSame.discomfort ? ' · con molestia' : ''}
              </p>
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
            <p className="muted center-text">Vibra y suena en cada cambio de tramo. Mantiene la pantalla encendida. Si la página se recarga, el cardio sigue contando y se reabre solo.</p>
          </section>
        </>
      )}
    </div>
  )
}
