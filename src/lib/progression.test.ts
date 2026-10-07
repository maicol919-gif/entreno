import { describe, expect, it } from 'vitest'
import { suggest, totalLoad } from './progression'
import { cardioFor, isDeload, mesocycleWeek, pendingDays, prescribe } from './plan'
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
