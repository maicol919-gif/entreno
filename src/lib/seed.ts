import { supabase } from './supabase'
import type { LoadType } from '../types'

interface ExDef {
  key: string
  name: string
  maru: string | null
  primary: string
  secondary: string[]
  equipment: string
  load: LoadType
  incr: number
  reps: [number, number]
  bar?: number
  note?: string
}

const EX: ExDef[] = [
  { key: 'pressPecho', name: 'Press de pecho máquina horizontal', maru: 'PRESS DE PECHO EN MAQUINA HORIZONTAL', primary: 'Pecho', secondary: ['Tríceps', 'Hombros'], equipment: 'Máquina', load: 'total', incr: 2.5, reps: [6, 10] },
  { key: 'pressIncMancuernas', name: 'Press banca inclinado mancuernas', maru: 'PRESS DE BANCA INCLINADO MANCUERNAS', primary: 'Pecho', secondary: ['Hombros', 'Tríceps'], equipment: 'Mancuernas y banco', load: 'per_hand', incr: 2.5, reps: [8, 12], note: 'Anota la inclinación del banco (ej. 2 o 3).' },
  { key: 'pressIncSmith', name: 'Press inclinado Smith', maru: 'PRESS INCLINADO EN MULTIPOWER (SMITH)', primary: 'Pecho', secondary: ['Hombros', 'Tríceps'], equipment: 'Smith', load: 'plates_per_side_plus_bar', incr: 2.5, reps: [6, 10], note: 'Registra discos por lado. Anota la inclinación.' },
  { key: 'fondos', name: 'Fondos libres', maru: 'FONDOS LIBRES', primary: 'Pecho', secondary: ['Tríceps'], equipment: 'Fondos asistidos', load: 'assistance', incr: 6.8, reps: [8, 12], note: 'Carga = AYUDA en kg. Menos ayuda es mejor; meta 0 kg.' },
  { key: 'remoMaq', name: 'Remo unilateral máquina', maru: 'REMO UNILATERAL MAQUINA', primary: 'Espalda', secondary: ['Bíceps'], equipment: 'Máquina', load: 'total', incr: 4.5, reps: [8, 12], note: 'Anota la posición de la almohadilla.' },
  { key: 'remoPolea', name: 'Remo unilateral banco en polea', maru: 'REMO UNILATERAL CON BANCO EN POLEA', primary: 'Espalda', secondary: ['Bíceps'], equipment: 'Polea', load: 'total', incr: 5, reps: [10, 12] },
  { key: 'remoMancuernas', name: 'Remo pecho en banco mancuernas', maru: 'REMO PECHO EN BANCO MANCUERNAS', primary: 'Espalda', secondary: ['Bíceps', 'Hombros'], equipment: 'Mancuernas y banco', load: 'per_hand', incr: 2.5, reps: [10, 12] },
  { key: 'jalon', name: 'Jalón al pecho', maru: null, primary: 'Espalda', secondary: ['Bíceps'], equipment: 'Polea / máquina', load: 'total', incr: 5, reps: [8, 12], note: 'Nuevo en tu rutina: tirón vertical.' },
  { key: 'posteriorSentado', name: 'Elevación posterior sentado', maru: 'ELEVACION PARA POSTERIOR SENTADO', primary: 'Hombros', secondary: ['Espalda'], equipment: 'Mancuernas y banco', load: 'per_hand', incr: 2.5, reps: [12, 15] },
  { key: 'posteriorPolea', name: 'Elevación posterior cruzada polea baja', maru: 'ELEVACION POSTERIOR CRUZADA EN POLEA BAJA', primary: 'Hombros', secondary: ['Espalda'], equipment: 'Polea', load: 'total', incr: 1.1, reps: [12, 15] },
  { key: 'lateralPolea', name: 'Elevación lateral polea baja', maru: 'ELEVACION LATERAL POLEA BAJA', primary: 'Hombros', secondary: [], equipment: 'Polea', load: 'total', incr: 1.1, reps: [12, 20] },
  { key: 'isometrica', name: 'Elevación unilateral isométrica', maru: 'ELEVACION UNILATERAL ISOMETRICA', primary: 'Hombros', secondary: [], equipment: 'Mancuernas', load: 'per_hand', incr: 2.5, reps: [12, 15] },
  { key: 'pressMilitarMan', name: 'Press militar mancuernas', maru: 'PRESS MILITAR MANCUERNAS', primary: 'Hombros', secondary: ['Tríceps'], equipment: 'Mancuernas y banco', load: 'per_hand', incr: 2.5, reps: [8, 12] },
  { key: 'pressMilitarSmith', name: 'Press militar Smith', maru: 'PRES MILITAR EN MAQUINA SMITH', primary: 'Hombros', secondary: ['Tríceps'], equipment: 'Smith', load: 'plates_per_side_plus_bar', incr: 2.5, reps: [10, 15] },
  { key: 'mentón', name: 'Elevación a mentón (trapecio)', maru: 'ELEVACION A MENTON PARA TRAPECIO', primary: 'Trapecio', secondary: ['Hombros'], equipment: 'Barra / polea', load: 'total', incr: 2.5, reps: [12, 15], note: 'Omítelo si te molesta el hombro.' },
  { key: 'encogimiento', name: 'Encogimiento de hombros mancuernas', maru: 'ENCOGIMIENTO DE HOMBROS CON MANCUERNAS.', primary: 'Trapecio', secondary: [], equipment: 'Mancuernas', load: 'per_hand', incr: 2.5, reps: [12, 15] },
  { key: 'martillo', name: 'Curl martillo', maru: 'CURL MARTILLO', primary: 'Bíceps', secondary: [], equipment: 'Mancuernas', load: 'per_hand', incr: 2.5, reps: [8, 12] },
  { key: 'martilloAlt', name: 'Curl martillo alterno de pie', maru: 'CURL MARTILLO MANCUERNAS DE PIE ALTERNADO', primary: 'Bíceps', secondary: [], equipment: 'Mancuernas', load: 'per_hand', incr: 2.5, reps: [8, 12] },
  { key: 'curlPolea1', name: 'Curl a una mano polea baja', maru: 'CURL A UNA MANO EN POLEA BAJA', primary: 'Bíceps', secondary: [], equipment: 'Polea', load: 'total', incr: 2.3, reps: [12, 15] },
  { key: 'curlPolea2', name: 'Curl de pie polea a dos manos', maru: 'CURL BICEPS DE PIE POLEA A DOS MANOS', primary: 'Bíceps', secondary: [], equipment: 'Polea', load: 'total', incr: 2.3, reps: [12, 15] },
  { key: 'curlSentado', name: 'Curl de bíceps sentado mancuernas', maru: 'CURL DE BICEPS SENTADO CON MANCUERNAS', primary: 'Bíceps', secondary: [], equipment: 'Mancuernas y banco', load: 'per_hand', incr: 2.5, reps: [10, 15] },
  { key: 'curlConcentrado', name: 'Curl concentrado en máquina', maru: 'CURL CONCENTRADO EN MAQUINA', primary: 'Bíceps', secondary: [], equipment: 'Máquina', load: 'total', incr: 5, reps: [10, 15] },
  { key: 'francesZ', name: 'Press francés barra Z', maru: 'PRES FRANCES CON BARRA Z', primary: 'Tríceps', secondary: [], equipment: 'Barra Z y banco', load: 'total', incr: 2.5, reps: [8, 12] },
  { key: 'extTriceps', name: 'Extensión tríceps polea alta (una mano)', maru: 'EXTENSION TRICEPS A UNA MANO POLEA ALTA', primary: 'Tríceps', secondary: [], equipment: 'Polea', load: 'total', incr: 5, reps: [10, 15] },
  { key: 'prensa', name: 'Prensa de piernas', maru: null, primary: 'Cuádriceps', secondary: ['Glúteos'], equipment: 'Máquina', load: 'total', incr: 5, reps: [8, 12], note: 'Pies a media altura, baja en 2 s, sin llegar al fallo (RIR 3).' },
  { key: 'sentadillaSmith', name: 'Sentadilla Smith', maru: 'SENTADILLA MAQUINA SMITH', primary: 'Cuádriceps', secondary: ['Glúteos'], equipment: 'Smith', load: 'plates_per_side_plus_bar', incr: 2.5, reps: [8, 12], note: 'Registra discos por lado. Define el peso de la barra del Smith en Ajustes.' },
  { key: 'sentadillaAbierta', name: 'Sentadilla abierta Smith', maru: 'SENTADILLA ABIERTA EN MAQUINA SMITH', primary: 'Cuádriceps', secondary: ['Isquiotibiales', 'Glúteos'], equipment: 'Smith', load: 'plates_per_side_plus_bar', incr: 2.5, reps: [8, 12] },
  { key: 'bulgara', name: 'Sentadilla búlgara', maru: 'SENTADILLA BÚLGARA (ENFOQUE CUÁDRICEPS)', primary: 'Cuádriceps', secondary: ['Glúteos'], equipment: 'Mancuernas y banco', load: 'per_hand', incr: 2.5, reps: [8, 12], note: 'Entra desde la semana 8: es la que más agujetas da.' },
  { key: 'extCuad', name: 'Extensión de cuádriceps', maru: null, primary: 'Cuádriceps', secondary: [], equipment: 'Máquina', load: 'total', incr: 5, reps: [10, 15] },
  { key: 'curlFemoral', name: 'Curl femoral sentado', maru: null, primary: 'Isquiotibiales', secondary: [], equipment: 'Máquina', load: 'total', incr: 5, reps: [10, 12] },
  { key: 'hipThrust', name: 'Hip thrust', maru: null, primary: 'Glúteos', secondary: ['Isquiotibiales'], equipment: 'Smith / máquina de glúteo', load: 'total', incr: 5, reps: [8, 12] },
  { key: 'pmr', name: 'Peso muerto rumano barra', maru: 'PESO MUERTO RUMANO BARRA', primary: 'Isquiotibiales', secondary: ['Glúteos'], equipment: 'Barra', load: 'plates_per_side_plus_bar', incr: 2.5, reps: [8, 12], bar: 20, note: 'Entra desde la semana 8: 1-2 series al inicio.' },
  { key: 'aductor', name: 'Encogimiento aductor', maru: 'ENCOGIMIENTO ADUCTOR', primary: 'Aductores', secondary: [], equipment: 'Máquina', load: 'total', incr: 3.5, reps: [12, 15] },
  { key: 'gemelo', name: 'Elevación gemelo máquina', maru: 'ELEVACION GEMELO MAQUINA', primary: 'Gemelos', secondary: [], equipment: 'Máquina', load: 'total', incr: 5, reps: [10, 15], note: 'Registra el peso TOTAL (no por lado) para poder compararlo.' },
  { key: 'crunch', name: 'Crunch', maru: 'CRUNCH', primary: 'Abdomen', secondary: [], equipment: 'Peso corporal', load: 'total', incr: 2.5, reps: [12, 15] },
  { key: 'bicicleta', name: 'Abdominales estilo bicicleta', maru: 'ABDOMINALES ESTILO BICICLETA.', primary: 'Abdomen', secondary: [], equipment: 'Peso corporal', load: 'total', incr: 2.5, reps: [12, 15] },
]

type ItemDef = [key: string, sets: number, repMin: number, repMax: number, rir: number, startWeek?: number]

const ROUTINE: { weekday: number; name: string; items: ItemDef[] }[] = [
  {
    weekday: 1,
    name: 'Torso A',
    items: [
      ['pressPecho', 3, 6, 10, 2],
      ['pressIncMancuernas', 3, 8, 12, 2],
      ['remoMaq', 3, 8, 12, 2],
      ['remoPolea', 3, 10, 12, 2],
      ['posteriorSentado', 2, 12, 15, 1],
      ['extTriceps', 2, 10, 15, 1],
    ],
  },
  {
    weekday: 2,
    name: 'Pierna A (cuádriceps)',
    items: [
      ['prensa', 3, 8, 12, 2],
      ['sentadillaSmith', 2, 8, 12, 2],
      ['extCuad', 3, 10, 15, 1],
      ['bulgara', 2, 8, 12, 2, 8],
      ['gemelo', 3, 10, 15, 1],
      ['crunch', 3, 12, 15, 2],
    ],
  },
  {
    weekday: 3,
    name: 'Hombros y brazos',
    items: [
      ['pressMilitarMan', 3, 8, 12, 2],
      ['lateralPolea', 3, 12, 20, 1],
      ['posteriorPolea', 2, 12, 15, 1],
      ['martillo', 3, 8, 12, 2],
      ['curlPolea1', 2, 12, 15, 1],
      ['francesZ', 3, 8, 12, 2],
      ['mentón', 2, 12, 15, 2],
    ],
  },
  {
    weekday: 4,
    name: 'Pierna B (femoral y glúteo)',
    items: [
      ['curlFemoral', 3, 10, 12, 2],
      ['hipThrust', 3, 8, 12, 2],
      ['pmr', 2, 8, 12, 2, 8],
      ['aductor', 2, 12, 15, 2],
      ['gemelo', 3, 12, 15, 1],
      ['bicicleta', 3, 12, 15, 2],
    ],
  },
  {
    weekday: 5,
    name: 'Torso B',
    items: [
      ['jalon', 3, 8, 12, 2],
      ['pressIncSmith', 3, 6, 10, 2],
      ['remoMancuernas', 3, 10, 12, 2],
      ['fondos', 3, 8, 12, 2],
      ['curlSentado', 2, 10, 15, 1],
      ['isometrica', 2, 12, 15, 1],
    ],
  },
]

/** Siembra catálogo y rutina la primera vez. Devuelve true si sembró. */
export async function seedIfEmpty(): Promise<boolean> {
  const { count, error } = await supabase.from('exercises').select('id', { count: 'exact', head: true })
  if (error) throw error
  if ((count ?? 0) > 0) return false

  const { data: ex, error: e1 } = await supabase
    .from('exercises')
    .insert(
      EX.map((e) => ({
        name: e.name,
        maru_name: e.maru,
        muscle_primary: e.primary,
        muscles_secondary: e.secondary,
        equipment: e.equipment,
        load_type: e.load,
        bar_kg: e.bar ?? 0,
        min_increment_kg: e.incr,
        rep_min: e.reps[0],
        rep_max: e.reps[1],
        fixed_note: e.note ?? null,
      })),
    )
    .select('id,name')
  if (e1) throw e1
  const idByName = new Map(ex!.map((r) => [r.name as string, r.id as string]))
  const idByKey = new Map(EX.map((e) => [e.key, idByName.get(e.name)!]))

  const { data: days, error: e2 } = await supabase
    .from('routine_days')
    .insert(ROUTINE.map((d) => ({ weekday: d.weekday, name: d.name })))
    .select('id,weekday')
  if (e2) throw e2
  const dayByWeekday = new Map(days!.map((d) => [d.weekday as number, d.id as string]))

  const items = ROUTINE.flatMap((d) =>
    d.items.map(([key, sets, repMin, repMax, rir, startWeek], i) => ({
      day_id: dayByWeekday.get(d.weekday)!,
      exercise_id: idByKey.get(key)!,
      position: i + 1,
      sets,
      rep_min: repMin,
      rep_max: repMax,
      rir_target: rir,
      start_week: startWeek ?? 1,
    })),
  )
  const { error: e3 } = await supabase.from('routine_items').insert(items)
  if (e3) throw e3

  const { error: e4 } = await supabase.from('settings').upsert({ mesocycle_start: '2026-09-28', rest_seconds: 120 })
  if (e4) throw e4
  return true
}
