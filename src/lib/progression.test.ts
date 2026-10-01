import { describe, expect, it } from 'vitest'
import { suggest, totalLoad } from './progression'
import { cardioFor, isDeload, mesocycleWeek, pendingDays, prescribe } from './plan'
import { intervalSession, intervalWarnings, legReasons, locate, nextInterval, recoveryWalk, totalSeconds } from './treadmill'
import type { PastSession, RoutineItem } from '../types'

const mk = (sets: [number, number, number | null][]): PastSession => ({
  session_id: 's',
  date: '2026-09-29',
  note: '',
  sets: sets.map(([reps, load_kg, rir], i) => ({ reps, load_kg, rir, set_number: i + 1 })),
})

const base = { sets: 3, repMin: 8, repMax: 12, rirTarget: 2, loadType: 'total' as const, increment: 2.5 }

describe('suggest', () => {
  it('sin historial pide elegir carga', () => {
    expect(suggest({ ...base, last: null }).kind).toBe('new')
  })
  it('sube carga si todas las series llegan al tope con RIR suficiente', () => {
    const r = suggest({ ...base, last: mk([[12, 50, 2], [12, 50, 2], [12, 50, 3]]) })
    expect(r.kind).toBe('raise')
    expect(r.targets[0]).toEqual({ reps: 8, load_kg: 52.5 })
  })
  it('no sube si el RIR fue menor al objetivo', () => {
    const r = suggest({ ...base, last: mk([[12, 50, 1], [12, 50, 2], [12, 50, 2]]) })
    expect(r.kind).toBe('repeat')
  })
  it('repite carga y suma una repetición al promedio', () => {
    const r = suggest({ ...base, last: mk([[10, 50, 2], [9, 50, 2], [8, 50, 1]]) })
    expect(r.targets).toEqual([{ reps: 10, load_kg: 50 }, { reps: 10, load_kg: 50 }, { reps: 10, load_kg: 50 }])
  })
  it('con pirámide usa la carga más exigente repetida (press militar 25-sep)', () => {
    const r = suggest({ ...base, last: mk([[12, 10, 2], [10, 10, 2], [10, 12.5, 2], [8, 12.5, 2], [6, 15, 2]]) })
    expect(r.targets.every((t) => t.load_kg === 12.5)).toBe(true)
    expect(r.targets[0].reps).toBe(10)
  })
  it('curl martillo 24-sep: base 20 kg', () => {
    const r = suggest({ ...base, last: mk([[12, 17.5, 2], [10, 17.5, 2], [10, 20, 1], [8, 20, 1], [6, 20, 1]]) })
    expect(r.targets[0].load_kg).toBe(20)
  })
  it('fondos 29-sep: base 13.6 kg y, como superó el tope de reps, baja la ayuda a 6.8', () => {
    const r = suggest({ ...base, loadType: 'assistance', increment: 6.8, rirTarget: 1, last: mk([[15, 20.4, 3], [15, 13.6, 3], [15, 13.6, 1], [15, 13.6, 1]]) })
    expect(r.kind).toBe('raise')
    expect(r.targets[0].load_kg).toBe(6.8)
  })
  it('sin repeticiones registradas usa el rango mínimo', () => {
    const r = suggest({ ...base, last: { session_id: 's', date: '2026-09-29', note: '', sets: [{ reps: null, load_kg: 12.5, rir: 2, set_number: 1 }, { reps: null, load_kg: 12.5, rir: 2, set_number: 2 }] } })
    expect(r.targets[0]).toEqual({ reps: 9, load_kg: 12.5 })
  })
  it('en ejercicios con ayuda la carga baja', () => {
    const r = suggest({ ...base, loadType: 'assistance', increment: 6.8, last: mk([[12, 13.6, 2], [12, 13.6, 2], [12, 13.6, 2]]) })
    expect(r.kind).toBe('raise')
    expect(r.targets[0].load_kg).toBe(6.8)
  })
  it('la ayuda nunca baja de 0', () => {
    const r = suggest({ ...base, loadType: 'assistance', increment: 6.8, last: mk([[12, 3, 2], [12, 3, 2], [12, 3, 2]]) })
    expect(r.targets[0].load_kg).toBe(0)
  })
})

describe('totalLoad', () => {
  it('discos por lado + barra', () => {
    expect(totalLoad(10, 'plates_per_side_plus_bar', 20)).toBe(40)
  })
})

describe('plan', () => {
  const item: RoutineItem = { id: 'i', day_id: 'd', exercise_id: 'e', position: 1, sets: 3, rep_min: 8, rep_max: 12, rir_target: 2, start_week: 1, note: null }
  it('pierna: 2 series y RIR 3 las semanas 1-3', () => {
    const p = prescribe(item, 'Cuádriceps', 2)
    expect(p.sets).toBe(2)
    expect(p.rirTarget).toBe(3)
  })
  it('pierna: series completas en semana 4 y RIR normal desde la 5', () => {
    expect(prescribe(item, 'Cuádriceps', 4).sets).toBe(3)
    expect(prescribe(item, 'Cuádriceps', 5).rirTarget).toBe(2)
  })
  it('torso no tiene arranque suave', () => {
    expect(prescribe(item, 'Pecho', 1).sets).toBe(3)
  })
  it('descarga cada 7 semanas reduce a la mitad', () => {
    expect(isDeload(7)).toBe(true)
    expect(prescribe(item, 'Pecho', 7).sets).toBe(2)
  })
  it('semana del mesociclo desde el lunes de inicio', () => {
    expect(mesocycleWeek('2026-09-28', new Date('2026-10-01T10:00:00'))).toBe(1)
    expect(mesocycleWeek('2026-09-28', new Date('2026-10-05T10:00:00'))).toBe(2)
  })
})

describe('cardioFor', () => {
  it('días 1, 3 y 5: intervalos', () => {
    for (const d of [1, 3, 5]) expect(cardioFor(d, 2)?.kind).toBe('intervalos')
  })
  it('días 2 y 4 (pierna): caminata suave opcional', () => {
    expect(cardioFor(2, 2)).toMatchObject({ kind: 'recuperacion', optional: true })
    expect(cardioFor(4, 2)?.kind).toBe('recuperacion')
  })
  it('semana de descarga: solo suave', () => {
    expect(cardioFor(1, 7)?.kind).toBe('recuperacion')
  })
  it('fin de semana sin cardio programado', () => {
    expect(cardioFor(6, 1)).toBeNull()
  })
})

describe('protocolo de cinta', () => {
  it('sesión original: 15 min exactos, bloques 9,5/9,5/10/10', () => {
    const segs = intervalSession({ warmup: 'basic', recoverySec: 45, lastBlockSpeed: 10 })
    expect(totalSeconds(segs)).toBe(900)
    expect(segs.filter((x) => x.kind === 'fast').map((x) => x.speed)).toEqual([9.5, 9.5, 10, 10])
  })
  it('calentamiento ampliado: 4:30 antes del primer bloque y 16:30 en total', () => {
    const segs = intervalSession({ warmup: 'extended', recoverySec: 45, lastBlockSpeed: 10 })
    const firstFast = segs.findIndex((x) => x.kind === 'fast')
    expect(totalSeconds(segs.slice(0, firstFast))).toBe(270)
    expect(totalSeconds(segs)).toBe(990)
  })
  it('recuperación de 30 s acorta la sesión 45 s en total', () => {
    expect(totalSeconds(intervalSession({ warmup: 'extended', recoverySec: 30, lastBlockSpeed: 10 }))).toBe(945)
  })
  it('caminata suave: 15 min, de 1 a 5 % de inclinación', () => {
    const w = recoveryWalk()
    expect(totalSeconds(w)).toBe(900)
    expect(Math.max(...w.map((x) => x.incline))).toBe(5)
  })
  it('locate encuentra el segmento por tiempo transcurrido', () => {
    const w = recoveryWalk()
    expect(locate(w, 0)).toEqual({ index: 0, left: 60 })
    expect(locate(w, 61)?.index).toBe(1)
    expect(locate(w, 900)).toBeNull()
  })
  it('primera sesión: calentamiento ampliado y recuperación 45 s', () => {
    expect(nextInterval(null).config).toEqual({ warmup: 'extended', recoverySec: 45, lastBlockSpeed: 10 })
  })
  it('una sola variable: primero el calentamiento, luego la recuperación', () => {
    const a = nextInterval({ protocol: { warmup: 'basic', recoverySec: 45 }, speech_test: 'entera', discomfort: false })
    expect(a.config).toMatchObject({ warmup: 'extended', recoverySec: 45 })
    const b = nextInterval({ protocol: { warmup: 'extended', recoverySec: 45 }, speech_test: 'entera', discomfort: false })
    expect(b.config.recoverySec).toBe(30)
  })
  it('frase partida en dos: repetir igual', () => {
    const r = nextInterval({ protocol: { warmup: 'extended', recoverySec: 45 }, speech_test: 'dos', discomfort: false })
    expect(r.config).toMatchObject({ recoverySec: 45, lastBlockSpeed: 10 })
  })
  it('no pasa de la mitad: baja 0,5 km/h el último bloque', () => {
    const r = nextInterval({ protocol: { warmup: 'extended', recoverySec: 45 }, speech_test: 'mitad', discomfort: false })
    expect(r.config.lastBlockSpeed).toBe(9.5)
  })
  it('molestia: sugiere caminata suave', () => {
    expect(nextInterval({ protocol: null, speech_test: 'entera', discomfort: true }).suggestSoft).toBe(true)
  })
  it('avisa si ayer hubo intervalos o ya van 3 en la semana', () => {
    expect(intervalWarnings([{ date: '2026-10-05', kind: 'intervalos' }], '2026-10-06', '2026-10-01')).toHaveLength(1)
    const w = intervalWarnings(
      [{ date: '2026-10-05', kind: 'intervalos' }, { date: '2026-10-07', kind: 'intervalos' }, { date: '2026-10-09', kind: 'intervalos' }],
      '2026-10-11',
      '2026-10-05',
    )
    expect(w.length).toBe(1)
  })
})

describe('pendingDays', () => {
  it('sin sesiones o con un solo día: nada pendiente', () => {
    expect(pendingDays([])).toEqual([])
    expect(pendingDays([3])).toEqual([])
  })
  it('detecta el día saltado entre el primero y el último', () => {
    expect(pendingDays([1, 3])).toEqual([2])
    expect(pendingDays([1, 4, 5])).toEqual([2, 3])
  })
  it('un ciclo que empezó a mitad (3, 4) no genera pendientes anteriores', () => {
    expect(pendingDays([3, 4])).toEqual([])
  })
})

describe('piernas y cardio', () => {
  it('sin pierna reciente ni agujetas: sin motivos', () => {
    expect(legReasons({ yesterday: false, soreness: null })).toEqual([])
    expect(legReasons({ yesterday: false, soreness: 5 })).toEqual([])
  })
  it('pierna ayer o agujetas >= 6: recomienda suave', () => {
    expect(legReasons({ yesterday: true, soreness: null })).toHaveLength(1)
    expect(legReasons({ yesterday: false, soreness: 6 })).toHaveLength(1)
    expect(legReasons({ yesterday: true, soreness: 8 })).toHaveLength(2)
  })
  it('caminata con piernas cargadas: máx. 2 % y 5,0 km/h, misma duración', () => {
    const w = recoveryWalk(true)
    expect(totalSeconds(w)).toBe(900)
    expect(Math.max(...w.map((x) => x.incline))).toBe(2)
    expect(Math.max(...w.map((x) => x.speed))).toBe(5)
  })
})
