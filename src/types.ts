export type LoadType = 'total' | 'per_side' | 'per_hand' | 'plates_per_side_plus_bar' | 'assistance'

export interface Exercise {
  id: string
  name: string
  maru_name: string | null
  muscle_primary: string
  muscles_secondary: string[]
  equipment: string | null
  load_type: LoadType
  bar_kg: number
  min_increment_kg: number
  rep_min: number
  rep_max: number
  fixed_note: string | null
  available: boolean
}

export interface RoutineDay {
  id: string
  weekday: number
  name: string
}

export interface RoutineItem {
  id: string
  day_id: string
  exercise_id: string
  position: number
  sets: number
  rep_min: number
  rep_max: number
  rir_target: number
  start_week: number
  note: string | null
}

export interface Session {
  id: string
  date: string
  day_id: string | null
  note: string | null
  soreness: number | null
  status: 'in_progress' | 'done'
  source: string
}

export interface SetRow {
  id: string
  session_id: string
  exercise_id: string
  set_number: number
  reps: number | null
  load_kg: number | null
  rir: number | null
  is_warmup: boolean
  done: boolean
}

export interface PastSet {
  reps: number | null
  load_kg: number | null
  rir: number | null
  set_number: number
}

export interface PastSession {
  session_id: string
  date: string
  sets: PastSet[]
  note: string
}
