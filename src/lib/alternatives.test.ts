import { describe, expect, it } from 'vitest'
import { alternatives } from './alternatives'
import type { Exercise } from '../types'

const mk = (id: string, name: string, equipment: string, muscle = 'Espalda', over: Partial<Exercise> = {}): Exercise => ({
  id,
  name,
  muscle_primary: muscle,
  muscles_secondary: ['Bíceps'],
  equipment,
  load_type: 'total',
  bar_kg: 0,
  min_increment_kg: 2.5,
  rep_min: 8,
  rep_max: 12,
  fixed_note: null,
  available: true,
  ...over,
})

const remoBanco = mk('1', 'Remo pecho en banco mancuernas', 'Mancuernas y banco', 'Espalda', { load_type: 'per_hand' })
const jalon = mk('2', 'Jalón al pecho', 'Polea / máquina')
const remoMaq = mk('3', 'Remo unilateral máquina', 'Máquina')
const remoMan = mk('4', 'Remo con mancuernas en banco plano', 'Mancuernas y banco', 'Espalda', { load_type: 'per_hand' })
const pecho = mk('5', 'Press de pecho', 'Máquina', 'Pecho')
const all = [remoBanco, jalon, remoMaq, remoMan, pecho]

describe('alternatives', () => {
  it('solo propone ejercicios del mismo músculo', () => {
    expect(alternatives(remoBanco, all, [], 'otro').every((e) => e.muscle_primary === 'Espalda')).toBe(true)
  })
  it('si los pies resbalan prefiere máquinas/poleas y evita el banco', () => {
    const r = alternatives(remoBanco, all, [], 'pies')
    expect(r.map((e) => e.id)).toEqual(['2', '3', '4'])
  })
  it('no propone lo que ya está en el día ni lo no disponible', () => {
    const r = alternatives(remoBanco, [...all.slice(0, 2), { ...remoMaq, available: false }, remoMan], ['2'], 'pies')
    expect(r.map((e) => e.id)).toEqual(['4'])
  })
  it('respeta el límite', () => {
    expect(alternatives(remoBanco, all, [], 'otro', 1)).toHaveLength(1)
  })
})
