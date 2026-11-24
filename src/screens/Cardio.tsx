import OtherMachine from './OtherMachine'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmtDate } from '../lib/history'
import { toISODate, type CardioPlan } from '../lib/plan'
import { readRun, writeRun, type Run } from '../lib/cardioRun'
import {
  EFFORT_LEVELS,
  LEVEL_LABEL,
  MATCH_LABEL,
  SEVERITY_LABEL,
  SPEECH_PHRASE,
  buildSession,
  capLevel,
  cardioPhase,
  discomfortHold,
  intervalWarnings,
  kindOf,
  speechWindow,
  buildSession as buildSessionFull,
  totalSeconds as totalSecondsFull,
  MIN_CARDIO_MIN,
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
  type Severity,
  type PastCardio,
  type Segment,
  type SpeechTest,
} from '../lib/treadmill'
import { beep, useRest } from '../rest'

interface LogRow extends PastCardio {
  id: string
  discomfort_severity: Severity | null
  resolved_at: string | null
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

/** Protocolo personal compartido por Maycol. Se guarda separado del progreso automático de la cinta. */
const PERSONAL_PROTOCOL: Segment[] = [
  { label: 'Calentamiento', sec: 3 * 60, speed: 4.0, incline: 2, kind: 'warm' },
  { label: 'Entrada en ritmo', sec: 5 * 60, speed: 4.5, incline: 8, kind: 'warm' },
  { label: 'Bloque de trabajo', sec: 5 * 60, speed: 5.0, incline: 10, kind: 'fast' },
  { label: 'Pico de intensidad', sec: 5 * 60, speed: 5.0, incline: 14, kind: 'fast' },
  { label: 'Segundo bloque', sec: 5 * 60, speed: 5.5, incline: 10, kind: 'fast' },
  { label: 'Bajada', sec: 4 * 60, speed: 4.5, incline: 5, kind: 'rec' },
  { label: 'Enfriamiento', sec: 3 * 60, speed: 3.5, incline: 0, kind: 'cool' },
]
const PERSONAL_DURATION_OPTIONS = [30, 35, 40, 45]

function personalProtocolFor(minutes: number): Segment[] {
  const extraMin = Math.max(0, minutes - 30)
  if (!extraMin) return PERSONAL_PROTOCOL
  const cooldown = PERSONAL_PROTOCOL[PERSONAL_PROTOCOL.length - 1]
  return [
    ...PERSONAL_PROTOCOL.slice(0, -1),
    { label: 'Caminata continua extra', sec: extraMin * 60, speed: 4.5, incline: 5, kind: 'rec' },
    cooldown,
  ]
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
  /** minutos de caminata suave extra que sugiere el plan de tiempo de hoy */
  extraMin?: number
  plan: CardioPlan
  sessionId: string
  sessionDate: string
  legCtx: LegContext
  week: number
  onBack: () => void
}

export default function Cardio({ plan, sessionId, sessionDate, legCtx, week, extraMin = 0, onBack }: Props) {
  const { clear: clearRest } = useRest()
  const saved = useRef(readRun())
  const [logs, setLogs] = useState<LogRow[] | null>(null)
  const [other, setOther] = useState(false)
  const [route, setRoute] = useState<'choose' | 'guided' | 'custom'>(() => saved.current?.mode === 'custom' ? 'custom' : 'choose')
  const [personalMinutes, setPersonalMinutes] = useState(30)
  const [useExtra, setUseExtra] = useState(true)
  /** minutos de cardio que tienes hoy (null = el cardio completo de tu nivel) */
  const [minutesAvail, setMinutesAvail] = useState<number | null>(saved.current?.minutes ?? null)
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
  const [severity, setSeverity] = useState<Severity | null>(null)
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
      .select('id,date,kind,minutes,speech_test,discomfort,protocol,created_at,discomfort_severity,resolved_at')
      .gte('date', toISODate(new Date(Date.now() - 60 * 86400000)))
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data }) => setLogs((data ?? []) as LogRow[]))
  }, [])

  // una sesión corta solo puede bajar la exigencia (si el habla no pasó de la mitad); para subirla cuenta la última sesión completa
  const isShortLog = (l: LogRow) => !!(l.protocol as { short?: boolean } | null)?.short
  const lastOf = (kind: string): LastInterval | null => {
    const same = (logs ?? []).filter((x) => x.kind === kind)
    const first = same[0]
    if (!first) return null
    const l = isShortLog(first) && first.speech_test !== 'mitad' ? same.find((x) => !isShortLog(x)) : first
    return l ? { protocol: l.protocol ?? null, speech_test: l.speech_test, discomfort: l.discomfort } : null
  }
  const recentHard = (): LastInterval[] =>
    (logs ?? [])
      .filter((x) => x.kind === 'intervalos' && !isShortLog(x))
      .slice(0, 3)
      .map((l) => ({ protocol: l.protocol ?? null, speech_test: l.speech_test, discomfort: l.discomfort }))
  const nextHard = useMemo(() => nextInterval(lastOf('intervalos'), recentHard()), [logs]) // eslint-disable-line react-hooks/exhaustive-deps
  const nextMed = useMemo(() => nextMedium(lastOf('media')), [logs]) // eslint-disable-line react-hooks/exhaustive-deps
  const warnings = useMemo(() => intervalWarnings(logs ?? [], today, sevenDaysAgo()), [logs, today])
  const hints = useMemo(() => legHints(legCtx), [legCtx])
  const hold = useMemo(() => discomfortHold((logs ?? []).filter((l) => l.kind !== 'otra' || l.discomfort).map((l) => ({ date: l.date, discomfort: l.discomfort, severity: l.discomfort_severity, resolved: !!l.resolved_at, protocol: l.protocol }))), [logs])

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
  const minutesEff = run ? (run.minutes ?? null) : minutesAvail
  const extraEff = run ? run.extraMin ?? 0 : useExtra && minutesAvail == null && extraMin >= 5 ? extraMin : 0
  const fullSec = useMemo(() => (level ? totalSecondsFull(buildSessionFull(level, ph, cfg, reduced, null)) : 0), [level, ph, cfg, reduced])
  const isShort = minutesEff != null && minutesEff * 60 < fullSec
  const segs: Segment[] = useMemo(() => {
    if (run?.mode === 'custom') return run.customSegments ?? []
    if (!level) return []
    const base = buildSession(level, ph, cfg, reduced, minutesEff)
    if (extraEff <= 0 || level === 'suave') return base
    // la caminata extra va antes del enfriamiento, después de la última recuperación (test de habla)
    const walk: Segment = { label: 'Caminata suave extra', sec: extraEff * 60, speed: 5.0, incline: 2, kind: 'rec' }
    return [...base.slice(0, -1), walk, base[base.length - 1]]
  }, [level, ph, cfg, reduced, minutesEff, extraEff])
  const total = totalSeconds(segs)

  const elapsed = run ? Math.max(0, Math.floor((now - run.start) / 1000)) : 0
  const pos = run ? locate(segs, elapsed) : null
  const finished = run != null && pos == null
  const sw = useMemo(() => speechWindow(segs), [segs])
  const speechNow = run != null && sw != null && elapsed >= sw.from && elapsed < sw.to
  const speechSoon = run != null && sw != null && elapsed >= sw.from - 20 && elapsed < sw.from

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

  // aviso fuerte cuando llega el momento de decir la frase del test de habla
  useEffect(() => {
    if (!speechNow) return
    navigator.vibrate?.([400, 150, 400, 150, 400])
    beep()
    window.setTimeout(beep, 350)
  }, [speechNow])

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

  /** Molestia leve que ya pasó: se levanta la pausa sin esperar otra sesión. */
  async function resolveHold() {
    const target = (logs ?? []).find((l) => l.discomfort)
    if (!target) return
    const when = new Date().toISOString()
    const { error } = await supabase.from('cardio_logs').update({ resolved_at: when }).eq('id', target.id)
    if (!error) setLogs((cur) => (cur ?? []).map((l) => (l.id === target.id ? { ...l, resolved_at: when } : l)))
  }

  function begin() {
    if (!feel || !level) return
    clearRest()
    lastIndex.current = -1
    const r: Run = { start: Date.now(), sessionId, sessionDate, level, phase: phaseEff, cfg, reduced, feel, match, minutes: isShort ? minutesEff : null, extraMin: extraEff }
    setNow(r.start)
    setRun(r)
    writeRun(r)
  }

  function beginPersonalProtocol() {
    clearRest()
    lastIndex.current = -1
    const r: Run = {
      start: Date.now(), mode: 'custom', protocolTitle: `Caminata inclinada · ${personalMinutes} min`,
      customSegments: personalProtocolFor(personalMinutes), sessionDate, level: 'suave', phase: 0, cfg, reduced: false,
      sessionId, feel: null, match: 'no',
    }
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
  const asksSpeech = run != null && completed && (run.mode === 'custom' || run.level !== 'suave')

  async function save() {
    if (!run || savingRef.current || done) return
    if (needsSpeech && !speech) {
      setErr('Haz el test de habla y elige el resultado.')
      return
    }
    if (discomfort && !severity) {
      setErr('Indica qué tan fuerte fue la molestia.')
      return
    }
    savingRef.current = true
    setSaving(true)
    setErr(null)
    const protocol = run.mode === 'custom'
      ? {
          type: 'protocolo_personalizado',
          title: run.protocolTitle ?? 'Protocolo personalizado',
          steps: (run.customSegments ?? []).map((s) => ({ label: s.label, minutes: s.sec / 60, speed_kmh: s.speed, incline_pct: s.incline })),
        }
      : run.level === 'dura'
        ? { ...run.cfg, phase: run.phase }
        : run.level === 'media'
          ? { mediumSpeed: run.cfg.mediumSpeed, phase: run.phase }
          : { phase: run.phase }
    if (run.mode !== 'custom' && run.minutes != null) Object.assign(protocol, { short: true, minutes: run.minutes })
    const { error } = await supabase.from('cardio_logs').insert({
      session_id: run.sessionId,
      date: run.sessionDate ?? sessionDate,
      kind: run.mode === 'custom' ? 'otra' : kindOf(run.level),
      machine: 'Trotadora',
      minutes: Math.max(1, Math.round((workedSec / 60) * 10) / 10),
      rpe: effort,
      speech_test: asksSpeech ? speech : null,
      discomfort,
      discomfort_severity: discomfort ? severity : null,
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
        {(speechNow || speechSoon) && sw && (
          <div className={`speechbanner ${speechNow ? 'now' : 'soon'}`} role="alert">
            {speechNow ? (
              <>
                <strong>Prueba del habla · {fmt(Math.max(0, sw.to - elapsed))}</strong>
                <div className="speech-prompt">“{SPEECH_PHRASE}”</div>
                <small>Dila de corrido, respirando normal. Al acabar, marca si salió entera, en dos partes o no pudiste terminarla.</small>
              </>
            ) : (
              <><strong>En {Math.max(1, Math.ceil(sw.from - elapsed))} s aparecerá la prueba del habla</strong><small>Cuando salga la frase, intenta decirla sin tomar aire antes.</small></>
            )}
          </div>
        )}
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
        <h2>{completed ? 'Cardio completo' : 'Cardio parcial'} · {run.mode === 'custom' ? run.protocolTitle : LEVEL_LABEL[run.level]}</h2>
        <p className="muted">Tiempo: {fmt(workedSec)}</p>

        {asksSpeech && (
          <section className="card">
            <h3>{run.mode === 'custom' ? '¿Cómo estuvo tu respiración?' : 'Test de habla'}</h3>
            <p className="muted">
              {run.mode === 'custom'
                ? <>Si quieres registrarlo, al acabar el tramo más exigente di: <em>“{SPEECH_PHRASE}”</em>. Es opcional y no cambia la progresión de la cinta.</>
                : <>{run.level === 'dura' ? 'Al final de la última recuperación' : 'En el último minuto del último bloque'}, di de corrido: <em>“{SPEECH_PHRASE}”</em></>}
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
          <button className="link" onClick={discard} disabled={saving || done}>Descartar</button>
        </section>
      </div>
    )
  }

  if (other) return <OtherMachine sessionId={sessionId} sessionDate={sessionDate} onBack={() => setOther(false)} onSaved={onBack} />

  if (route === 'choose') return (
    <div className="screen cardio-hub">
      <button className="link back" onClick={onBack}>← Sesión</button>
      <span className="eyebrow">CIERRE DE LA SESIÓN</span>
      <h2>¿Cómo quieres hacer cardio hoy?</h2>
      <p className="muted">Hay días para trabajar la resistencia y días para elegir una caminata que te motive. ¿Qué buscas hoy?</p>
      <section className="card cardio-route-list">
        <button className="cardio-route" onClick={() => setRoute('guided')}>
          <span className="route-icon recommended">↗</span>
          <span><strong>Mejorar resistencia respiratoria</strong><small>Plan guiado según tus piernas y progreso. Al final de un tramo exigente aparece una frase para valorar el esfuerzo.</small></span>
          <b aria-hidden="true">›</b>
        </button>
        <button className="cardio-route" onClick={() => setRoute('custom')}>
          <span className="route-icon personal">30′</span>
          <span><strong>Caminata inclinada / trabajo continuo</strong><small>Tu protocolo de ayer, con duración ampliable de 30 a 45 min.</small></span>
          <b aria-hidden="true">›</b>
        </button>
        <button className="cardio-route" onClick={() => setOther(true)}>
          <span className="route-icon machine">＋</span>
          <span><strong>Otra máquina o actividad</strong><small>Registra el cardio que sí hiciste sin cambiar la progresión de la cinta.</small></span>
          <b aria-hidden="true">›</b>
        </button>
      </section>
      <p className="muted cardio-separation">La frase del test solo aparece en el plan guiado, durante el último tramo exigente. En la caminata inclinada puedes seguir tu protocolo y registrar cómo se sintió, sin que aparezca esa pregunta. La inclinación suma actividad; no crea una zona especial que garantice más pérdida de grasa.</p>
    </div>
  )

  if (route === 'custom') {
    let elapsedPlan = 0
    return (
      <div className="screen">
        <button className="link back" onClick={() => setRoute('choose')}>← Opciones de cardio</button>
        <span className="eyebrow">TU PROTOCOLO · {personalMinutes} MIN</span>
        <h2>Caminata inclinada</h2>
        <p className="muted">Conserva los 7 tramos que compartiste. Elige cuánto tiempo tienes hoy; al ampliar, se añade caminata continua sin subir el pico de inclinación.</p>
        <section className="card">
          <h3>Duración</h3>
          <div className="timechips cardio-duration-options">
            {PERSONAL_DURATION_OPTIONS.map((minutes) => (
              <button key={minutes} className={`levelchip ${personalMinutes === minutes ? 'on' : ''}`} onClick={() => setPersonalMinutes(minutes)}>
                <strong>{minutes} min</strong>
              </button>
            ))}
          </div>
          {personalMinutes > 30 && <p className="muted">Se añaden {personalMinutes - 30} min a 4,5 km/h e inclinación 5 %, antes de la bajada y el enfriamiento.</p>}
          <ol className="seglist">
            {personalProtocolFor(personalMinutes).map((s, i) => {
              const start = elapsedPlan
              elapsedPlan += s.sec
              return <li key={i} className={`next ${s.kind}`}>
                <span className="when">{fmt(start)}</span><span className="inc">{s.incline} %</span>
                <span className="spd">{s.speed.toFixed(1)} km/h</span><span className="lbl">{s.label}</span><span className="dur">{fmt(s.sec)}</span>
              </li>
            })}
          </ol>
          <p className="fixed">El pico llega al 14 % de inclinación. Si aparece dolor o inestabilidad, reduce la inclinación o detén el tramo.</p>
          <button className="primary" onClick={beginPersonalProtocol}>Empezar caminata · {personalMinutes} min</button>
        </section>
      </div>
    )
  }

  // ───────── plan del día ─────────
  const lastSame = level ? logs?.find((l) => l.kind === kindOf(level)) : null
  let t = 0
  return (
    <div className="screen">
      <button className="link back" onClick={() => setRoute('choose')}>← Opciones de cardio</button>
      <h2>Cardio en cinta</h2>
      <button className="link" onClick={() => setOther(true)}>¿Cinta ocupada? Registrar otra máquina (bicicleta, elíptica…)</button>

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

          <section className="card">
            <h3>Contexto de hoy</h3>
            <p className="muted">Piernas {feel.toLowerCase()}. Partido: {MATCH_LABEL[match]}. Tope permitido: {LEVEL_LABEL[capEff].toUpperCase()}.</p>
            <button className="link" onClick={() => { setFeel(null); setLevelChoice(null) }}>Revisar contexto</button>
          </section>
          {hold.active && (
            <div className="fixed">
              <p>
                Molestia {hold.severity} registrada el {hold.since}: sin nivel DURA y sin subir de fase hasta {hold.need} sesión(es) sin molestia (llevas {hold.painFree} de {hold.need}).
                {hold.severity === 'fuerte' ? ' Si sigue o empeora, consulta a un fisioterapeuta.' : ''}
              </p>
              {hold.canResolve && (
                <div>
                  <p>¿Sigue la molestia?</p>
                  <div className="row">
                    <button onClick={() => void resolveHold()}>Ya no hay molestia</button>
                    <button className="link">Sigue</button>
                  </div>
                </div>
              )}
            </div>
          )}

          <section className="card">
            <h3>¿Cuánto tiempo tienes para el cardio?</h3>
            <div className="timechips">
              {[MIN_CARDIO_MIN, 15, 20, 25, 30, 40].filter((m) => m * 60 < fullSec).map((m) => (
                <button key={m} className={`levelchip ${minutesAvail === m ? 'on' : ''}`} onClick={() => setMinutesAvail(m)}>
                  <strong>{m} min</strong>
                </button>
              ))}
              <button className={`levelchip ${(minutesAvail == null || !isShort) && extraEff === 0 ? 'on' : ''}`} onClick={() => { setMinutesAvail(null); setUseExtra(false) }}>
                <strong>Completo · {Math.round(fullSec / 60)} min</strong>
              </button>
              {extraMin >= 5 && level !== 'suave' && (
                <button className={`levelchip ${extraEff > 0 ? 'on' : ''}`} onClick={() => { setMinutesAvail(null); setUseExtra(true) }}>
                  <strong>Completo + {extraMin} min suaves</strong>
                </button>
              )}
            </div>
            {isShort && <p className="muted">Versión corta: mismo calentamiento y enfriamiento, menos bloques y a las velocidades más altas del nivel. Cuenta como cardio hecho; para subir la exigencia se usa tu última sesión completa.</p>}
          </section>

          <div className="levels">
            {(['dura', 'media', 'suave'] as Level[]).map((l) => (
              <button key={l} disabled={(l === 'dura' && capEff !== 'dura') || (l === 'media' && capEff === 'suave')} className={`levelchip ${level === l ? 'on' : ''}`} onClick={() => setLevelChoice(l)}>
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
            <h3>{isShort ? 'Versión corta' : 'Toda la rutina'} · {Math.round(total / 60)} min</h3>
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
