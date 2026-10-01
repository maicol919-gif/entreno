import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseRir } from './import'

describe('parseRir', () => {
  it('rangos por grupos de series', () => {
    expect(parseRir('RIR 1-2/2 3-5/1', 5)).toEqual([2, 2, 1, 1, 1])
    expect(parseRir('Este lo hago ambos brazos a la vez RIR 1-2/2 3-5/1', 5)).toEqual([2, 2, 1, 1, 1])
  })
  it('series sueltas', () => {
    expect(parseRir('RIR 1/3 2-5/1', 5)).toEqual([3, 1, 1, 1, 1])
    expect(parseRir('RIR 1-2/2 3/1 4/0', 4)).toEqual([2, 2, 1, 0])
  })
  it('todas las series', () => {
    expect(parseRir('RIR todas 1', 5)).toEqual([1, 1, 1, 1, 1])
    expect(parseRir('RIR 2 todas', 4)).toEqual([2, 2, 2, 2])
    expect(parseRir('Todas RIR 1', 4)).toEqual([1, 1, 1, 1])
    expect(parseRir('RIR 2 en todas', 4)).toEqual([2, 2, 2, 2])
  })
  it('no inventa si no cubre todas las series', () => {
    expect(parseRir('RIR 1-2/2', 5)).toBeNull()
    expect(parseRir('Sin datos', 4)).toBeNull()
  })
})

import { existsSync } from 'node:fs'
const histPath = new URL('../../../maru-historial.json', import.meta.url)
describe.skipIf(!existsSync(histPath))('historial exportado', () => {
  const file = JSON.parse(readFileSync(histPath, 'utf8'))
  it('tiene 31 ejercicios con sesiones', () => {
    const list = Object.values(file.exercises) as { sessions: unknown[] }[]
    expect(list).toHaveLength(31)
    expect(list.every((e) => e.sessions.length > 0)).toBe(true)
  })
  it('cada ejercicio de Maru tiene un ejercicio en el catálogo', async () => {
    const src = readFileSync(new URL('./seed.ts', import.meta.url), 'utf8')
    const maru = [...src.matchAll(/maru: '([^']+)'/g)].map((m) => m[1])
    const missing = Object.keys(file.exercises).filter((n) => !maru.includes(n))
    expect(missing).toEqual([])
  })
})
