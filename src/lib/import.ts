import { supabase } from './supabase'

interface MaruSet {
  reps: number | null
  kg: number | null
}
interface MaruSession {
  date: string
  sets: MaruSet[]
  note: string
}
interface MaruExercise {
  name: string
  sessions: MaruSession[]
}
export interface MaruFile {
  exercises: Record<string, MaruExercise>
}

/**
 * Convierte notas tipo "RIR 1-2/2 3-5/1" o "RIR todas 2" en un RIR por serie.
 * Devuelve null si no cubre todas las series de forma clara.
 */
export function parseRir(note: string, nSets: number): (number | null)[] | null {
  const n = note.toLowerCase()
  if (n.includes('rir')) {
    const all = n.match(/rir\s*(?:todas?|todos)\s*(\d)|rir\s*(\d)\s*(?:en\s*)?(?:todas?|todos)|todas?\s*rir\s*(\d)|todos?\s*rir\s*(\d)/)
    if (all) {
      const v = Number(all[1] ?? all[2] ?? all[3] ?? all[4])
      return Array.from({ length: nSets }, () => v)
    }
    const out: (number | null)[] = Array.from({ length: nSets }, () => null)
    const re = /(\d)(?:-(\d))?\s*\/\s*(\d)/g
    let m: RegExpExecArray | null
    let any = false
    while ((m = re.exec(n.slice(n.indexOf('rir')))) !== null) {
      const a = Number(m[1])
      const b = m[2] ? Number(m[2]) : a
      for (let s = a; s <= b && s <= nSets; s++) {
        out[s - 1] = Number(m[3])
        any = true
      }
    }
    if (any && out.every((v) => v != null)) return out
  }
  return null
}

export async function importMaru(file: MaruFile): Promise<{ sessions: number; sets: number }> {
  const { data: exs, error } = await supabase.from('exercises').select('id,maru_name')
  if (error) throw error
  const exByMaru = new Map(exs!.filter((e) => e.maru_name).map((e) => [e.maru_name as string, e.id as string]))

  const { count } = await supabase.from('sessions').select('id', { count: 'exact', head: true }).eq('source', 'maru')
  if ((count ?? 0) > 0) throw new Error('El historial de Maru ya fue importado.')

  const dates = new Set<string>()
  for (const ex of Object.values(file.exercises)) for (const s of ex.sessions) dates.add(s.date)
  const sorted = [...dates].sort()

  const { data: created, error: e1 } = await supabase
    .from('sessions')
    .insert(sorted.map((date) => ({ date, source: 'maru', status: 'done' })))
    .select('id,date')
  if (e1) throw e1
  const sessionByDate = new Map(created!.map((s) => [s.date as string, s.id as string]))

  const setRows: Record<string, unknown>[] = []
  const noteRows: Record<string, unknown>[] = []
  for (const ex of Object.values(file.exercises)) {
    const exerciseId = exByMaru.get(ex.name)
    if (!exerciseId) continue
    const seen = new Set<string>()
    for (const s of ex.sessions) {
      if (seen.has(s.date)) continue // mismo ejercicio dos veces el mismo día: se queda el más reciente
      seen.add(s.date)
      const sessionId = sessionByDate.get(s.date)!
      const rirs = parseRir(s.note, s.sets.length)
      s.sets.forEach((st, i) =>
        setRows.push({
          session_id: sessionId,
          exercise_id: exerciseId,
          set_number: i + 1,
          reps: st.reps,
          load_kg: st.kg,
          rir: rirs ? rirs[i] : null,
          done: true,
        }),
      )
      if (s.note) noteRows.push({ session_id: sessionId, exercise_id: exerciseId, note: s.note })
    }
  }
  for (let i = 0; i < setRows.length; i += 200) {
    const { error: e2 } = await supabase.from('sets').insert(setRows.slice(i, i + 200))
    if (e2) throw e2
  }
  if (noteRows.length) {
    const { error: e3 } = await supabase.from('session_exercise_notes').insert(noteRows)
    if (e3) throw e3
  }
  return { sessions: sorted.length, sets: setRows.length }
}
