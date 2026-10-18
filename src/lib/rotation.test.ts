import { describe, expect, it } from 'vitest'
import { blockFor, itemsForBlock, nextBlockStart } from './rotation'
import type { Exercise, RoutineItem } from '../types'

const item = (id: string, ex: string, position: number, block: RoutineItem['block'] = null): RoutineItem =>
  ({ id, day_id: 'd1', exercise_id: ex, position, sets: 3, rep_min: 8, rep_max: 12, rir_target: 2, start_week: 1, note: null, block }) as RoutineItem
const ex = (id: string, available = true): Exercise => ({ id, available }) as Exercise

describe('bloques', () => {
  it('cambia cada 3 ciclos y vuelve a A', () => {
    expect([1, 2, 3, 4, 6, 7, 9, 10, 12, 13].map(blockFor)).toEqual(['A', 'A', 'A', 'B', 'B', 'C', 'C', 'A', 'A', 'B'])
    expect(nextBlockStart(2)).toBe(4)
    expect(nextBlockStart(4)).toBe(7)
  })
})

describe('itemsForBlock', () => {
  const items = [item('i1', 'e1', 1), item('i4a', 'a', 4, 'A'), item('i4b', 'b', 4, 'B'), item('i4c', 'c', 4, 'C')]
  it('mantiene los fijos y elige la opción del bloque', () => {
    expect(itemsForBlock(items, [ex('e1'), ex('a'), ex('b'), ex('c')], 'B').map((i) => i.exercise_id).sort()).toEqual(['b', 'e1'])
    expect(itemsForBlock(items, [ex('e1'), ex('a'), ex('b'), ex('c')], 'A').map((i) => i.exercise_id).sort()).toEqual(['a', 'e1'])
  })
  it('si la opción no está disponible usa la del bloque A', () => {
    expect(itemsForBlock(items, [ex('e1'), ex('a'), ex('b', false), ex('c')], 'B').map((i) => i.exercise_id).sort()).toEqual(['a', 'e1'])
  })
})
