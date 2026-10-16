export type LoadType = 'total' | 'per_side' | 'per_hand' | 'plates_per_side_plus_bar' | 'assistance'

export interface Exercise {
  id: string
  name: string
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

export interface Food {
  id: string
  name: string
  kcal: number
  protein: number
  carbs: number
  fat: number
  unit_g: number | null
  unit_label: string | null
  unit_plural: string | null
}

export type MealKey = 'desayuno' | 'comida' | 'merienda' | 'cena'

export interface Recipe {
  id: string
  name: string
  minutes: number
  meal: MealKey | 'cualquiera'
  steps: string
  tags: string[]
  servings: number
}

export interface RecipeItem {
  id: string
  recipe_id: string
  food_id: string
  grams: number
  position: number
}

export interface MealEntry {
  id: string
  date: string
  meal: MealKey
  recipe_id: string | null
  food_id: string | null
  label: string
  servings: number | null
  grams: number | null
  kcal: number
  protein: number
  carbs: number
  fat: number
  note: string | null
  items: { food_id: string; name: string; grams: number }[] | null
  photo_path: string | null
  status: 'done' | 'pending'
  created_at: string
}
