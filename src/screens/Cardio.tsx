import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmtDate } from '../lib/history'
import { toISODate, type CardioPlan } from '../lib/plan'
import { readRun, writeRun, type Run } from '../lib/cardioRun'
import {
  EFFORT_LEVELS,
  LEVEL_LABEL,
  MATCH_LABEL,
  SPEECH_PHRASE,
  buildSession,
  capLevel,
  cardioPhase,
  discomfortHold,
  intervalWarnings,
  kindOf,
  legHints,
  levelFor,
  levelMinutes,
  locate,
  matchCap,
  nextInterval,
  nextMedium,
  totalSeconds,
  type IntervalConfig,
  type LastInterval,
  type LegContext,
  type LegsFeel,
  type Level,
  type MatchSoon,
  type PastCardio,
  type Segment,
  type SpeechTest,
} from '../lib/treadmill'
import { beep, useRest } from '../rest'

interface LogRow extends PastCardio {
  minutes: number
  speech_test: SpeechTest | null
  discomfort: boolean
  protocol: (Partial<IntervalConfig> & { phase?: number }) | null
}

function sevenDaysAgo(): string {
  return toISODate(new Date(Date.now() - 6 * 86400000))
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

const FEEL_OPTIONS: { value: LegsFeel; label: string; hint: string }[] = [
  { value: 'frescas', label: 'Frescas', hint: 'sin molestia, con ganas · nivel DURA' },
  { value: 'normales', label: 'Normales', hint: 'algo de cansancio, nada raro · nivel MEDIA' },
  { value: 'cargadas', label: 'Cargadas', hint: 'agujetas o pesadez · nivel SUAVE' },
]

const LEVEL_HINT: Record<Level, string> = {
  dura: 'Intervalos a 9,5-10 km/h (esfuerzo 8-9)',
  media: 'Bloques continuos a ~8,5 km/h (esfuerzo 6-7)',
  suave: 'Caminata en cuesta (esfuerzo 3-4)',
}

function MatchChips({ value, onChange }: { value: MatchSoon; onChange: (m: MatchSoon) => void }) {
  return (
    <div className="levels">
      {(['no', 'hoy', 'manana'] as MatchSoon[]).map((m) => (
        <button key={m} className={`levelchip ${value === m ? 'on' : ''}`} onClick={() => onChange(m)}>
          <strong>{MATCH_LABEL[m]}</strong>
        </button>
      ))}
    </div>
  )
}

interface Props {
  plan: CardioPlan
  sessionId: string
  legCtx: LegContext
  week: number
  onBack: () => void
}

export default function Cardio({ plan, sessionId, legCtx, week, onBack }: Props) {
  const { clear: clearRest } = useRest()
  const saved = useRef(readRun())
  const [logs, setLogs] = useState<LogRow[] | null>(null)
  const [feel, setFeel] = useState<LegsFeel | null>(saved.current?.feel ?? null)
  const [levelChoice, setLevelChoice] = useState<Level | null>(null)
  const [match, setMatch] = useState<MatchSoon>(saved.current?.match === 'hoy' || saved.current?.match === 'manana' ? saved.current.match : 'no')
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
  const [flash, setFlash] = useState<{ key: number; kind: Segment['kind'] } | null>(null)
  const lastIndex = useRef(-1)
  const savingRef = useRef(false)

  const today = toISODate(new Date())
  const cp = cardioPhase(week)

  useEffect(() => {
    void supabase
      .from('cardio_logs')
      .select('date,kind,minutes,speech_test,discomfort,protocol,created_at')
      .gte('date', toISODate(new Date(Date.now() - 60 * 86400000)))
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data }) => setLogs((data ?? []) as LogRow[]))
  }, [])

  const lastOf = (kind: string): LastInterval | null => {
    const l = logs?.find((x) => x.kind === kind)
    return l ? { protocol: l.protocol ?? null, speech_test: l.speech_test, discomfort: l.discomfort } : null
  }
  const nextHard = useMemo(() => nextInterval(lastOf('intervalos')), [logs]) // eslint-disable-line react-hooks/exhaustive-deps
  const nextMed = useMemo(() => nextMedium(lastOf('media')), [logs]) // eslint-disable-line react-hooks/exhaustive-deps
  const warnings = useMemo(() => intervalWarnings(logs ?? [], today, sevenDaysAgo()), [logs, today])
  const hints = useMemo(() => legHints(legCtx), [legCtx])
  const hold = useMemo(() => discomfortHold((logs ?? []).map((l) => ({ date: l.date, discomfort: l.discomfort, protocol: l.protocol }))), [logs])

  // tope efectivo: el del día, el de la pausa por molestia (sin nivel dura) y el del partido
  const capEff: Level = capLevel(capLevel(plan.cap, hold.active ? 'media' : 'dura'), matchCap(match))
  // mientras haya pausa por molestia la duración no sube de la fase en que ocurrió
  const phaseEff = hold.active ? (Math.min(cp.phase, hold.phase) as typeof cp.phase) : cp.phase
  // nivel recomendado: según las piernas, con el tope y las reglas de descanso para el nivel duro
  const baseLevel = feel ? capLevel(levelFor(feel), capEff) : null
  const hardBlocked = baseLevel === 'dura' && warnings.length > 0
  const recommended: Level | null = baseLevel ? (hardBlocked ? 'suave' : baseLevel) : null
  const level: Level | null = run?.level ?? levelChoice ?? recommended

  const reduced = run?.reduced ?? (feel === 'cargadas' && level === 'suave')
  const cfg: IntervalConfig = run?.cfg ?? { ...nextHard.config, mediumSpeed: nextMed.mediumSpeed }
  const ph = run?.phase ?? phaseEff
  const segs: Segment[] = useMemo(() => (level ? buildSession(level, ph, cfg, reduced) : []), [level, ph, cfg, reduced])
  const total = totalSeconds(segs)

  const elapsed = run ? Math.max(0, Math.floor((now - run.start) / 1000)) : 0
  const pos = run ? locate(segs, elapsed) : null
  const finished = run != null && pos == null

  useEffect(() => {
    if (!run || finished) return
    const t = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(t)
  }, [run, finished])

  // aviso al cambiar de tramo: parpadeo de color + pitido (+ vibración donde el navegador la permita)
  useEffect(() => {
    if (!run) return
    const idx = pos ? pos.index : segs.length
    if (idx !== lastIndex.current) {
      if (lastIndex.current !== -1) {
        navigator.vibrate?.(idx >= segs.length ? [300, 150, 300, 150, 300] : segs[idx].kind === 'fast' ? [200, 100, 200] : [200])
        beep()
        setFlash({ key: Date.now(), kind: idx >= segs.length ? 'cool' : segs[idx].kind })
      }
      lastIndex.current = idx
    }
  }, [run, pos, segs])

  // el tramo actual siempre queda visible en la lista
  useEffect(() => {
    if (!run || !pos) return
    document.getElementById(`seg-${pos.index}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [run, pos?.index]) // eslint-disable-line react-hooks/exhaustive-deps

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
    if (!feel || !level) return
    clearRest()
    lastIndex.current = -1
    const r: Run = { start: Date.now(), level, phase: phaseEff, cfg, reduced, sessionId, feel, match }
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
  const needsSpeech = run != null && completed && run.level !== 'suave'

  async function save() {
    if (!run || savingRef.current || done) return
    if (needsSpeech && !speech) {
      setErr('Haz el test de habla y elige el resultado.')
      return
    }
    savingRef.current = true
    setSaving(true)
    setErr(null)
    const protocol =
      run.level === 'dura'
        ? { ...run.cfg, phase: run.phase }
        : run.level === 'media'
          ? { mediumSpeed: run.cfg.mediumSpeed, phase: run.phase }
          : { phase: run.phase }
    const { error } = await supabase.from('cardio_logs').insert({
      session_id: run.sessionId,
      date: toISODate(new Date(run.start)),
      kind: kindOf(run.level),
      machine: 'Trotadora',
      minutes: Math.max(1, Math.round((workedSec / 60) * 10) / 10),
      rpe: effort,
      speech_test: needsSpeech ? speech : null,
      discomfort,
      protocol,
      legs_feel: run.feel,
      match_soon: run.match ?? 'no',
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

  // ───────── ejecución guiada ─────────
  if (run && phase === 'plan' && pos) {
    const seg = segs[pos.index]
    const remaining = Math.max(0, total - elapsed)
    let acc = 0
    const starts = segs.map((s) => {
      const from = acc
      acc += s.sec
      return from
    })
    // marcas de cada bloque duro sobre la barra de progreso
    const marks = segs.map((s, i) => ({ i, s })).filter((x) => x.s.kind === 'fast').map((x) => (starts[x.i] / total) * 100)
    return (
      <div className="screen">
        {flash && <div key={flash.key} className={`flash ${flash.kind}`} aria-hidden="true" />}
        <div className={`runcard ${seg.kind}`}>
          <p className="runlabel">{seg.label}</p>
          <div className="runpanels">
            <div>
              <small>INCLINACIÓN</small>
              <strong>{seg.incline}<span>%</span></strong>
            </div>
            <div>
              <small>VELOCIDAD</small>
              <strong>{seg.speed.toFixed(1)}<span>km/h</span></strong>
            </div>
          </div>
          <p className="runleft">{fmt(pos.left)}</p>
        </div>

        <div className="progress marks">
          <div style={{ width: `${Math.min(100, (elapsed / total) * 100)}%` }} />
          {marks.map((m, k) => <i key={k} style={{ left: `${m}%` }} />)}
        </div>
        <p className="muted center-text">Quedan {fmt(remaining)} de {fmt(total)}</p>

        <ol className="seglist">
          {segs.map((s, i) => {
            const cls = i < pos.index ? 'done' : i === pos.index ? 'current' : 'next'
            return (
              <li id={`seg-${i}`} key={i} className={`${cls} ${s.kind}`}>
                <span className="when">{fmt(starts[i])}</span>
                <span className="inc">{s.incline} %</span>
                <span className="spd">{s.speed.toFixed(1)} km/h</span>
                <span className="lbl">{s.label}</span>
                <span className="dur">{fmt(s.sec)}</span>
              </li>
            )
          })}
        </ol>

        {run.level === 'dura' && <p className="muted center-text">No te agarres de la barra. No recortes el enfriamiento.</p>}
        <button onClick={stop}>Terminar antes</button>
      </div>
    )
  }

  // ───────── formulario final ─────────
  if (run && phase === 'form') {
    return (
      <div className="screen">
        <h2>{completed ? 'Cardio completo' : 'Cardio parcial'} · {LEVEL_LABEL[run.level]}</h2>
        <p className="muted">Tiempo: {fmt(workedSec)}</p>

        {needsSpeech && (
          <section className="card">
            <h3>Test de habla</h3>
            <p className="muted">
              {run.level === 'dura' ? 'Al final de la última recuperación' : 'En el último minuto del último bloque'}, di de corrido: <em>“{SPEECH_PHRASE}”</em>
            </p>
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
  const lastSame = level ? logs?.find((l) => l.kind === kindOf(level)) : null
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
          <h3>¿Tienes partido pronto?</h3>
          <MatchChips value={match} onChange={setMatch} />
          {plan.cap !== 'dura' && <p className="muted">Hoy el tope es nivel {LEVEL_LABEL[plan.cap].toUpperCase()}{plan.optional ? ' y el cardio es opcional' : ''}.</p>}
        </section>
      )}

      {feel && level && (
        <>
          <p className="muted">
            Piernas {feel}. <button className="link" onClick={() => { setFeel(null); setLevelChoice(null) }}>Cambiar</button>
          </p>

          <MatchChips value={match} onChange={setMatch} />
          {match !== 'no' && <p className="muted">{MATCH_LABEL[match]}: hoy el tope es nivel {LEVEL_LABEL[matchCap(match)].toUpperCase()}.</p>}
          {hold.active && (
            <p className="fixed">
              Molestia registrada el {hold.since}: sin nivel DURA y sin subir de fase hasta tener 2 sesiones seguidas sin molestia (llevas {hold.painFree} de 2).
            </p>
          )}

          <div className="levels">
            {(['dura', 'media', 'suave'] as Level[]).map((l) => (
              <button key={l} className={`levelchip ${level === l ? 'on' : ''}`} onClick={() => setLevelChoice(l)}>
                <strong>{LEVEL_LABEL[l]}</strong>
                <span>{levelMinutes(l, phaseEff)} min</span>
                {recommended === l && <small>recomendado</small>}
              </button>
            ))}
          </div>
          <p className="muted">
            {LEVEL_HINT[level]}.{' '}
            {cp.deload ? 'Semana de descarga: duraciones de la fase 1.' : `Fase ${phaseEff + 1} de 3 del ciclo${hold.active && phaseEff < cp.phase ? ' (en pausa por la molestia)' : ''}.`}
          </p>

          {logs === null && <p className="muted">Cargando…</p>}
          {(level === 'dura' || hardBlocked) && warnings.map((w) => <p key={w} className="fixed">⚠ {w}</p>)}
          {level === 'dura' && <p className="fixed">📌 {nextHard.message}</p>}
          {level === 'media' && <p className="fixed">📌 {nextMed.message}</p>}
          {level === 'suave' && reduced && <p className="muted">Como tus piernas están cargadas, la caminata va con inclinación máx. 2 % y velocidad máx. 5,0 km/h.</p>}
          {plan.optional && <p className="muted">Hoy el cardio es opcional (día de pierna).</p>}

          <section className="card last">
            <h3>Última vez ({LEVEL_LABEL[level]})</h3>
            {lastSame ? (
              <p>
                {fmtDate(lastSame.date)}: {lastSame.minutes} min
                {lastSame.speech_test ? ` · habla: ${lastSame.speech_test === 'entera' ? 'entera' : lastSame.speech_test === 'dos' ? 'en dos' : 'no pasó de la mitad'}` : ''}
                {lastSame.discomfort ? ' · con molestia' : ''}
              </p>
            ) : (
              <p className="muted">Primera vez registrada en este nivel.</p>
            )}
          </section>

          <section className="card">
            <h3>Toda la rutina · {Math.round(total / 60)} min</h3>
            <ol className="seglist">
              {segs.map((s, i) => {
                const from = t
                t += s.sec
                return (
                  <li key={i} className={`next ${s.kind}`}>
                    <span className="when">{fmt(from)}</span>
                    <span className="inc">{s.incline} %</span>
                    <span className="spd">{s.speed.toFixed(1)} km/h</span>
                    <span className="lbl">{s.label}</span>
                    <span className="dur">{fmt(s.sec)}</span>
                  </li>
                )
              })}
            </ol>
            <button className="primary" onClick={begin} disabled={logs === null}>Empezar guiado</button>
            <p className="muted center-text">Parpadea y suena en cada cambio de tramo. Mantiene la pantalla encendida. Si la página se recarga, el cardio sigue contando y se reabre solo.</p>
          </section>
        </>
      )}
    </div>
  )
}
