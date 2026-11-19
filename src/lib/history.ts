import { supabase } from './supabase'
import type { PastSession } from '../types'

interface Row {
  session_id: string
  set_number: number
  reps: number | null
  load_kg: number | null
  rir: number | null
  sessions: { date: string; status: string } | { date: string; status: string }[]
}

/** Sesiones anteriores (completadas) de un ejercicio, de la más reciente a la más antigua. */
export async function loadPast(exerciseId: string, excludeSessionId?: string): Promise<PastSession[]> {
  let q = supabase
    .from('sets')
    .select('session_id,set_number,reps,load_kg,rir,sessions!inner(date,status)')
    .eq('exercise_id', exerciseId)
    .eq('sessions.status', 'done')
    .neq('sessions.source', 'app_incomplete')
    .eq('done', true)
    .eq('is_warmup', false)
  if (excludeSessionId) q = q.neq('session_id', excludeSessionId)
  const [{ data, error }] = await Promise.all([q])
  if (error) throw error
  const typedNotes = await supabase.from('session_exercise_notes').select('session_id,note,note_type').eq('exercise_id', exerciseId)
  const notesData = typedNotes.error?.code === '42703'
    ? (await supabase.from('session_exercise_notes').select('session_id,note').eq('exercise_id', exerciseId)).data
    : typedNotes.data
  const noteBy = new Map<string, { note: string; note_type?: string }>()
  for (const n of notesData ?? []) noteBy.set(String(n.session_id), { note: String(n.note ?? ''), note_type: 'note_type' in n ? (n.note_type as string | null) ?? undefined : undefined })
  const by = new Map<string, PastSession>()
  for (const r of data as unknown as Row[]) {
    const date = Array.isArray(r.sessions) ? r.sessions[0].date : r.sessions.date
    let s = by.get(r.session_id)
    if (!s) {
      const previousNote = noteBy.get(r.session_id)
      s = { session_id: r.session_id, date, sets: [], note: previousNote?.note ?? '', note_type: previousNote?.note_type }
      by.set(r.session_id, s)
    }
    s.sets.push({ reps: r.reps, load_kg: r.load_kg, rir: r.rir, set_number: r.set_number })
  }
  const out = [...by.values()]
  for (const s of out) s.sets.sort((a, b) => a.set_number - b.set_number)
  return out.sort((a, b) => b.date.localeCompare(a.date))
}

export function fmtDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function fmtSets(sets: PastSession['sets']): string {
  return sets
    .map((s) => `${s.reps ?? '–'}×${s.load_kg ?? '–'}${s.rir != null ? ` (RIR ${s.rir >= 3 ? '3+' : s.rir})` : ''}`)
    .join(' · ')
}
