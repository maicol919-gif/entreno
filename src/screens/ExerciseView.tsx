import { useEffect, useRef, useState } from 'react'
import { useRest } from '../rest'
import { supabase } from '../lib/supabase'
import { fmtDate, fmtSets, loadPast } from '../lib/history'
import { suggest, type Suggestion } from '../lib/progression'
import type { Prescription } from '../lib/plan'
import { GUIDES, VIDEOS, videoSearchUrl } from '../data/guides'
import { useData } from '../store'
import { SIMILAR } from '../data/similar'
import type { Exercise, PastSession, SetRow } from '../types'

const LOAD_LABEL: Record<Exercise['load_type'], string> = {
  total: 'kg',
  per_side: 'kg por lado',
  per_hand: 'kg por mano',
  plates_per_side_plus_bar: 'kg de discos por lado',
  assistance: 'kg de AYUDA',
}

const inflight = new Map<string, Promise<SetRow[]>>()

/** Series que no se pudieron guardar (sin señal). Se reintenta fuera de cualquier pantalla: sigue aunque cambies de ejercicio. */
const unsaved = new Map<string, SetRow>()

async function saveRow(row: SetRow): Promise<void> {
  const { error } = await supabase.from('sets').update({ reps: row.reps, load_kg: row.load_kg, rir: row.rir, done: row.done }).eq('id', row.id)
  if (error) unsaved.set(row.id, row)
  else unsaved.delete(row.id)
}

function flushUnsaved() {
  for (const row of [...unsaved.values()]) void saveRow(row)
}

if (typeof window !== 'undefined') {
  window.setInterval(flushUnsaved, 5000)
  window.addEventListener('online', flushUnsaved)
}

interface Props {
  exercise: Exercise
  sessionId: string
  rx: Prescription
  restSeconds: number
  /** series de aproximación sugeridas antes de la primera serie de trabajo (no se registran) */
  warmup?: number
  onBack: () => void
  /** nombre del siguiente ejercicio del día (null si es el último) */
  nextName: string | null
  onNext: () => void
  /** el ejercicio incomodó la última vez que se hizo */
  flag: { reason: string | null; date: string } | null
  /** reemplazos sugeridos (mismo músculo, disponibles) */
  alts: Exercise[]
  onReplace: (exerciseId: string) => void
  /** "No hay esta máquina": marca el ejercicio como no disponible y devuelve reemplazos */
  onMissing: () => Promise<Exercise[]>
}

const STAR_TEXT = ['No me gustó nada', 'Casi no me gustó', 'Normal', 'Me gustó', 'Me encantó']

export default function ExerciseView({ exercise, sessionId, rx, restSeconds, warmup = 0, onBack, nextName, onNext, flag, alts, onReplace, onMissing }: Props) {
  const [missingAlts, setMissingAlts] = useState<Exercise[] | null>(null)
  const [sets, setSets] = useState<SetRow[] | null>(null)
  const [past, setPast] = useState<PastSession[]>([])
  const [sugg, setSugg] = useState<Suggestion | null>(null)
  const [note, setNote] = useState('')
  const { start: startTimer } = useRest()
  const [needRir, setNeedRir] = useState<string | null>(null)
  const setsRef = useRef<SetRow[] | null>(null)
  const [pending, setPending] = useState(0)
  const [showGuide, setShowGuide] = useState(false)
  const [showVideo, setShowVideo] = useState(false)
  const [fb, setFb] = useState<'idle' | 'ask' | 'sent'>('idle')
  const [fbNote, setFbNote] = useState('')
  const { exercises: allExercises } = useData()
  const [rating, setRating] = useState<number | null>(null)
  const [avg, setAvg] = useState<{ avg: number; n: number } | null>(null)
  const [ref, setRef] = useState<{ name: string; last: PastSession } | null>(null)
  const videoId = VIDEOS[exercise.name]
  const guide = GUIDES[exercise.name]
  useEffect(() => {
    setsRef.current = sets
  }, [sets])

  const startRest = () => startTimer(restSeconds)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const p = await loadPast(exercise.id, sessionId)
      const s = suggest({
        last: p[0] ?? null,
        sets: rx.sets,
        repMin: rx.repMin,
        repMax: rx.repMax,
        rirTarget: rx.rirTarget,
        loadType: exercise.load_type,
        increment: exercise.min_increment_kg,
      })
      const cur = await supabase.from('sets').select('*').eq('session_id', sessionId).eq('exercise_id', exercise.id).order('set_number')
      const nt = await supabase.from('session_exercise_notes').select('note,uncomfortable,discomfort_reason,rating').eq('session_id', sessionId).eq('exercise_id', exercise.id).maybeSingle()
      let rows = (cur.data ?? []) as SetRow[]
      if (rows.length === 0) {
        const key = `${sessionId}:${exercise.id}`
        let pending = inflight.get(key)
        if (!pending) {
          pending = (async () => {
            const ins = await supabase
              .from('sets')
              .insert(s.targets.map((t, i) => ({ session_id: sessionId, exercise_id: exercise.id, set_number: i + 1, reps: t.reps, load_kg: t.load_kg })))
              .select('*')
            return ((ins.data ?? []) as SetRow[]).sort((a, b) => a.set_number - b.set_number)
          })()
          inflight.set(key, pending)
        }
        rows = await pending
        inflight.delete(key)
      }
      if (cancelled) return
      setPast(p)
      setSugg(s)
      setSets(rows)
      setNote(nt.data?.note ?? '')
      setRating((nt.data?.rating as number | null) ?? null)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.id, sessionId, rx.sets, rx.repMin, rx.repMax, rx.rirTarget])

  async function save(row: SetRow) {
    await saveRow(row)
    setPending(unsaved.size)
  }

  // indicador de lo pendiente (el reintento en sí vive fuera del componente)
  useEffect(() => {
    const t = window.setInterval(() => setPending(unsaved.size), 1000)
    return () => window.clearInterval(t)
  }, [])

  function patch(id: string, p: Partial<SetRow>, persist = false) {
    const cur = setsRef.current
    if (!cur) return
    const next = cur.map((r) => (r.id === id ? { ...r, ...p } : r))
    setsRef.current = next // síncrono: dos toques seguidos ven siempre el estado más reciente
    setSets(next)
    // se guarda aquí y no dentro de setSets: así un cambio de pantalla inmediato no lo cancela
    if (persist) void save(next.find((r) => r.id === id)!)
  }

  function toggleDone(row: SetRow) {
    if (!row.done && row.rir == null) {
      setNeedRir(row.id)
      return
    }
    setNeedRir(null)
    patch(row.id, { done: !row.done }, true)
    if (!row.done) startRest()
  }

  async function addSet() {
    const last = sets?.[sets.length - 1]
    const { data } = await supabase
      .from('sets')
      .insert({ session_id: sessionId, exercise_id: exercise.id, set_number: (last?.set_number ?? 0) + 1, reps: last?.reps ?? rx.repMin, load_kg: last?.load_kg ?? null })
      .select('*')
      .single()
    if (data) setSets((cur) => [...(cur ?? []), data as SetRow])
  }

  async function removeSet(row: SetRow) {
    await supabase.from('sets').delete().eq('id', row.id)
    setSets((cur) => (cur ?? []).filter((r) => r.id !== row.id))
  }

  async function saveNote() {
    await supabase.from('session_exercise_notes').upsert({ session_id: sessionId, exercise_id: exercise.id, note })
  }

  // puntuación media de este ejercicio y, si es nuevo, referencia de un ejercicio parecido
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data } = await supabase.from('session_exercise_notes').select('rating').eq('exercise_id', exercise.id).not('rating', 'is', null)
      const rs = (data ?? []).map((r) => Number(r.rating))
      if (!cancelled) setAvg(rs.length ? { avg: rs.reduce((a, b) => a + b, 0) / rs.length, n: rs.length } : null)
      const simName = SIMILAR[exercise.name]
      const sim = simName ? allExercises.find((e) => e.name === simName) : undefined
      if (sim) {
        const p = await loadPast(sim.id)
        if (!cancelled) setRef(p[0] ? { name: sim.name, last: p[0] } : null)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.id])

  async function saveRating(n: number | null) {
    setRating(n)
    // 1-2 estrellas = no te gustó: la próxima vez se proponen reemplazos
    const low = n != null && n <= 2
    await supabase.from('session_exercise_notes').upsert({ session_id: sessionId, exercise_id: exercise.id, note, rating: n, uncomfortable: low, discomfort_reason: null })
  }

  async function sendVideoFeedback() {
    setFb('sent')
    await supabase.from('exercise_feedback').insert({ exercise_id: exercise.id, kind: 'video_no_coincide', note: fbNote || null })
  }

  function useSuggestion() {
    if (!sugg || !sets) return
    sets.forEach((r, i) => {
      const t = sugg.targets[Math.min(i, sugg.targets.length - 1)]
      if (!r.done) patch(r.id, { reps: t.reps, load_kg: t.load_kg }, true)
    })
  }

  const last = past[0]
  const allDone = !!sets && sets.length > 0 && sets.every((r) => r.done)

  return (
    <div className="screen">
      <button className="link back" onClick={onBack}>← Sesión</button>
      <h2>{exercise.name}</h2>
      <p className="muted">
        {exercise.muscle_primary} · {rx.sets} × {rx.repMin}-{rx.repMax} · RIR {rx.rirTarget}
        {rx.label ? ` · ${rx.label}` : ''}
        {avg ? ` · ★ ${avg.avg.toFixed(1)} (${avg.n})` : ''}
      </p>
      {pending > 0 && <p className="err">Sin conexión: {pending} serie(s) pendientes de guardar. Se reintenta solo.</p>}
      {exercise.fixed_note && <p className="fixed">📌 {exercise.fixed_note}</p>}

      {flag && (
        <section className="card warn">
          <h3>La última vez no te gustó</h3>
          <p className="muted">Lo puntuaste con 1-2 estrellas ({flag.date}). Puedes reemplazarlo en tu rutina; el historial de este ejercicio se conserva.</p>
          {alts.length === 0 && <p className="muted">No encuentro reemplazos disponibles del mismo músculo. Marca más ejercicios como disponibles en Gimnasio o dime qué máquinas hay.</p>}
          {alts.map((a) => (
            <button key={a.id} className="choice" onClick={() => onReplace(a.id)}>
              Cambiar por <strong>{a.name}</strong> <span className="muted">· {a.equipment ?? ''}</span>
            </button>
          ))}
          <p className="muted">Si lo mantienes y hoy lo puntúas con 3 o más, esta alerta desaparece.</p>
        </section>
      )}

      {missingAlts && (
        <section className="card warn">
          <h3>Sin esta máquina</h3>
          <p className="muted">Quedó marcada como no disponible. Elige con qué reemplazarla en tu rutina:</p>
          {missingAlts.length === 0 && <p className="muted">No encuentro reemplazos del mismo músculo. Dímelo y lo resolvemos.</p>}
          {missingAlts.map((a) => (
            <button key={a.id} className="choice" onClick={() => onReplace(a.id)}>
              Cambiar por <strong>{a.name}</strong> <span className="muted">· {a.equipment ?? ''}</span>
            </button>
          ))}
        </section>
      )}

      <section className="card guide">
        <div className="row between">
          <h3>Cómo hacerlo</h3>
          <button className="link" onClick={() => setShowGuide((v) => !v)}>{showGuide ? 'Ocultar' : 'Ver'}</button>
        </div>
        {showGuide && guide && (
          <>
            <p><strong>Posición:</strong> {guide.setup}</p>
            <ol>{guide.steps.map((s) => <li key={s}>{s}</li>)}</ol>
            <p><strong>Evita:</strong></p>
            <ul>{guide.errors.map((s) => <li key={s}>{s}</li>)}</ul>
          </>
        )}
        {showGuide && !guide && <p className="muted">Aún no hay guía escrita para este ejercicio.</p>}
        {videoId && !showVideo && <button className="primary" onClick={() => setShowVideo(true)}>▶ Ver video de la técnica</button>}
        {videoId && showVideo && (
          <div className="video">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&playsinline=1`}
              title={exercise.name}
              allow="encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              loading="lazy"
            />
          </div>
        )}
        <a className="btnlink" href={videoSearchUrl(exercise.name, guide?.query)} target="_blank" rel="noreferrer">
          {videoId ? 'Buscar más videos' : '▶ Buscar videos de la técnica'}
        </a>
        {fb === 'idle' && (
          <button className="link" onClick={() => setFb('ask')}>El video o la explicación no coinciden</button>
        )}
        {fb === 'ask' && (
          <div>
            <label>¿Qué es distinto? (opcional)
              <input value={fbNote} onChange={(e) => setFbNote(e.target.value)} placeholder="Ej.: el video lo hace sentado y yo de pie" />
            </label>
            <div className="row">
              <button onClick={() => void sendVideoFeedback()}>Enviar aviso</button>
              <button className="link" onClick={() => setFb('idle')}>Cancelar</button>
            </div>
          </div>
        )}
        {fb === 'sent' && <p className="muted">Gracias: lo reviso y lo corrijo.</p>}
      </section>

      <section className="card last">
        <h3>Última vez</h3>
        {last ? (
          <>
            <p className="muted">{fmtDate(last.date)}</p>
            <p>{fmtSets(last.sets)}</p>
            {last.note && <p className="note">“{last.note}”</p>}
          </>
        ) : (
          <p className="muted">Primera vez con este ejercicio.</p>
        )}
      </section>

      {warmup > 0 && (
        <section className="card">
          <h3>Aproximación</h3>
          <p>
            {(() => {
              const w = sugg?.targets?.[0]?.load_kg
              const inc = exercise.min_increment_kg || 2.5
              const r = (f: number) => (w ? String(Math.max(inc, Math.round((w * f) / inc) * inc)) : null)
              const parts = warmup >= 2 ? [['8', r(0.5)], ['5', r(0.75)]] : [['6', r(0.6)]]
              return 'Antes de la serie 1: ' + parts.map(([reps, kg]) => '1 × ' + reps + (kg ? ' con ' + kg + ' kg' : ' ligera')).join(' y ') + ', lejos del fallo. No se registran.'
            })()}
          </p>
        </section>
      )}

      {sugg && (
        <section className={`card sugg ${sugg.kind}`}>
          <h3>Objetivo de hoy</h3>
          <p>{sugg.message}</p>
          {sugg.kind !== 'new' && (
            <p className="targets">{sugg.targets.map((t) => `${t.reps}×${t.load_kg ?? '–'}`).join(' · ')}</p>
          )}
          {sugg.kind !== 'new' && <button onClick={useSuggestion}>Usar como base</button>}
          {sugg.kind === 'new' && ref && (
            <p className="muted">
              Referencia: en {ref.name} hiciste {fmtSets(ref.last.sets)} ({fmtDate(ref.last.date)}). Cada máquina carga distinto: empieza un 20-30 % más ligero con 3 repeticiones en reserva y ajusta en la primera serie.
            </p>
          )}
        </section>
      )}

      <section className="card">
        <h3>Registro <span className="muted">({LOAD_LABEL[exercise.load_type]})</span></h3>
        <div className="set head"><span>#</span><span>Reps</span><span>Carga</span><span>RIR</span><span /></div>
        {(sets ?? []).map((r) => (
          <div className={`set ${r.done ? 'done' : ''}`} key={r.id}>
            <span>{r.set_number}</span>
            <input inputMode="numeric" value={r.reps ?? ''} onChange={(e) => patch(r.id, { reps: e.target.value === '' ? null : Number(e.target.value) })} onBlur={() => save(setsRef.current!.find((x) => x.id === r.id)!)} />
            <input inputMode="decimal" value={r.load_kg ?? ''} onChange={(e) => patch(r.id, { load_kg: e.target.value === '' ? null : Number(e.target.value.replace(',', '.')) })} onBlur={() => save(setsRef.current!.find((x) => x.id === r.id)!)} />
            <select className={needRir === r.id ? 'bad' : ''} value={r.rir == null ? '' : Math.min(r.rir, 3)} onChange={(e) => patch(r.id, { rir: e.target.value === '' ? null : Number(e.target.value) }, true)}>
              <option value="">RIR</option>
              {[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n === 3 ? '3+' : n}</option>)}
            </select>
            <button className={r.done ? 'check on' : 'check'} onClick={() => toggleDone(r)} aria-label="Serie hecha">✓</button>
          </div>
        ))}
        {needRir && <p className="err">Indica el RIR (repeticiones que te quedaban) antes de marcar la serie.</p>}
        <div className="row">
          <button onClick={addSet}>+ Serie</button>
          {sets && sets.length > 0 && !sets[sets.length - 1].done && sets.length > 1 && (
            <button className="link" onClick={() => removeSet(sets[sets.length - 1])}>Quitar última</button>
          )}
        </div>
      </section>

      <section className="card">
        <h3>¿Qué tal te pareció?</h3>
        <div className="stars">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} className={rating != null && n <= rating ? 'on' : ''} onClick={() => void saveRating(rating === n ? null : n)} aria-label={`${n} estrellas`}>★</button>
          ))}
        </div>
        <p className="muted">{rating == null ? 'Opcional: 1 = no me gustó nada · 5 = me encantó. Sirve para elegir tus ejercicios preferidos.' : STAR_TEXT[rating - 1]}</p>
        <button className="link" onClick={() => { if (window.confirm('¿Marcar "' + exercise.name + '" como no disponible en tu gimnasio?')) void onMissing().then(setMissingAlts) }}>No hay esta máquina</button>
      </section>

      <button
        className={allDone ? 'primary next' : 'next'}
        onClick={() => (nextName ? onNext() : onBack())}
      >
        {nextName ? `Siguiente: ${nextName} →` : 'Último ejercicio: volver a la sesión ✓'}
      </button>
      {!allDone && sets && sets.length > 0 && <p className="muted center-text">Aún tienes series sin marcar.</p>}

      <section className="card">
        <h3>Nota de hoy</h3>
        <textarea rows={3} placeholder="Ej.: inclinación 3, molestia hombro, RIR por serie…" value={note} onChange={(e) => setNote(e.target.value)} onBlur={saveNote} />
      </section>

      {past.length > 1 && (
        <section className="card">
          <h3>Sesiones anteriores</h3>
          {past.slice(1, 5).map((p) => (
            <div key={p.session_id} className="pastrow">
              <p className="muted">{fmtDate(p.date)}</p>
              <p>{fmtSets(p.sets)}</p>
              {p.note && <p className="note">“{p.note}”</p>}
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
