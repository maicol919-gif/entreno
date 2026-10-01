import { useEffect, useRef, useState } from 'react'
import { useRest } from '../rest'
import { supabase } from '../lib/supabase'
import { fmtDate, fmtSets, loadPast } from '../lib/history'
import { suggest, type Suggestion } from '../lib/progression'
import type { Prescription } from '../lib/plan'
import { GUIDES, VIDEOS, videoSearchUrl } from '../data/guides'
import type { Exercise, PastSession, SetRow } from '../types'

const LOAD_LABEL: Record<Exercise['load_type'], string> = {
  total: 'kg',
  per_side: 'kg por lado',
  per_hand: 'kg por mano',
  plates_per_side_plus_bar: 'kg de discos por lado',
  assistance: 'kg de AYUDA',
}

const inflight = new Map<string, Promise<SetRow[]>>()

interface Props {
  exercise: Exercise
  sessionId: string
  rx: Prescription
  restSeconds: number
  onBack: () => void
}

export default function ExerciseView({ exercise, sessionId, rx, restSeconds, onBack }: Props) {
  const [sets, setSets] = useState<SetRow[] | null>(null)
  const [past, setPast] = useState<PastSession[]>([])
  const [sugg, setSugg] = useState<Suggestion | null>(null)
  const [note, setNote] = useState('')
  const { start: startTimer } = useRest()
  const [needRir, setNeedRir] = useState<string | null>(null)
  const dirty = useRef<Set<string>>(new Set())
  const setsRef = useRef<SetRow[] | null>(null)
  const [pending, setPending] = useState(0)
  const [showGuide, setShowGuide] = useState(false)
  const [showVideo, setShowVideo] = useState(false)
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
      const nt = await supabase.from('session_exercise_notes').select('note').eq('session_id', sessionId).eq('exercise_id', exercise.id).maybeSingle()
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
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.id, sessionId, rx.sets, rx.repMin, rx.repMax, rx.rirTarget])

  async function save(row: SetRow) {
    const { error } = await supabase.from('sets').update({ reps: row.reps, load_kg: row.load_kg, rir: row.rir, done: row.done }).eq('id', row.id)
    if (error) dirty.current.add(row.id)
    else dirty.current.delete(row.id)
    setPending(dirty.current.size)
  }

  // reintenta guardar lo pendiente cuando vuelve la señal
  useEffect(() => {
    const retry = () => {
      for (const id of [...dirty.current]) {
        const row = setsRef.current?.find((r) => r.id === id)
        if (row) void save(row)
        else dirty.current.delete(id)
      }
    }
    const t = window.setInterval(retry, 5000)
    window.addEventListener('online', retry)
    return () => {
      window.clearInterval(t)
      window.removeEventListener('online', retry)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function patch(id: string, p: Partial<SetRow>, persist = false) {
    setSets((cur) => {
      if (!cur) return cur
      const next = cur.map((r) => (r.id === id ? { ...r, ...p } : r))
      if (persist) void save(next.find((r) => r.id === id)!)
      return next
    })
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

  function useSuggestion() {
    if (!sugg || !sets) return
    sets.forEach((r, i) => {
      const t = sugg.targets[Math.min(i, sugg.targets.length - 1)]
      if (!r.done) patch(r.id, { reps: t.reps, load_kg: t.load_kg }, true)
    })
  }

  const last = past[0]

  return (
    <div className="screen">
      <button className="link back" onClick={onBack}>← Sesión</button>
      <h2>{exercise.name}</h2>
      <p className="muted">
        {exercise.muscle_primary} · {rx.sets} × {rx.repMin}-{rx.repMax} · RIR {rx.rirTarget}
        {rx.label ? ` · ${rx.label}` : ''}
      </p>
      {pending > 0 && <p className="err">Sin conexión: {pending} serie(s) pendientes de guardar. Se reintenta solo.</p>}
      {exercise.fixed_note && <p className="fixed">📌 {exercise.fixed_note}</p>}

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

      {sugg && (
        <section className={`card sugg ${sugg.kind}`}>
          <h3>Objetivo de hoy</h3>
          <p>{sugg.message}</p>
          {sugg.kind !== 'new' && (
            <p className="targets">{sugg.targets.map((t) => `${t.reps}×${t.load_kg ?? '–'}`).join(' · ')}</p>
          )}
          {sugg.kind !== 'new' && <button onClick={useSuggestion}>Usar como base</button>}
        </section>
      )}

      <section className="card">
        <h3>Registro <span className="muted">({LOAD_LABEL[exercise.load_type]})</span></h3>
        <div className="set head"><span>#</span><span>Reps</span><span>Carga</span><span>RIR</span><span /></div>
        {(sets ?? []).map((r) => (
          <div className={`set ${r.done ? 'done' : ''}`} key={r.id}>
            <span>{r.set_number}</span>
            <input inputMode="numeric" value={r.reps ?? ''} onChange={(e) => patch(r.id, { reps: e.target.value === '' ? null : Number(e.target.value) })} onBlur={() => save(sets!.find((x) => x.id === r.id)!)} />
            <input inputMode="decimal" value={r.load_kg ?? ''} onChange={(e) => patch(r.id, { load_kg: e.target.value === '' ? null : Number(e.target.value.replace(',', '.')) })} onBlur={() => save(sets!.find((x) => x.id === r.id)!)} />
            <select className={needRir === r.id ? 'bad' : ''} value={r.rir ?? ''} onChange={(e) => patch(r.id, { rir: e.target.value === '' ? null : Number(e.target.value) }, true)}>
              <option value="">RIR</option>
              {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
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
