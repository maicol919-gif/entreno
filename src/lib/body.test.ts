import { describe, expect, it } from 'vitest'
import { lastDate, paceVerdict, trend, waistGoalCm, whtr, whtrZone, windowMean, type BodyPoint } from './body'

const p = (date: string, kg: number | null, waist_cm: number | null = null): BodyPoint => ({ date, kg, waist_cm })

describe('cintura / altura', () => {
  it('85 cm con 172 cm de altura queda justo por debajo de 0,5', () => {
    const r = whtr(85, 172)
    expect(r).toBeCloseTo(0.494, 3)
    expect(whtrZone(r)).toBe('ok')
  })

  it('clasifica límite y alto', () => {
    expect(whtrZone(0.5)).toBe('limite')
    expect(whtrZone(0.59)).toBe('limite')
    expect(whtrZone(0.6)).toBe('alto')
  })

  it('cintura objetivo = un centímetro por debajo de la mitad de la altura', () => {
    expect(waistGoalCm(172)).toBe(85)
    expect(waistGoalCm(171)).toBe(85)
  })
})

describe('medias y tendencia', () => {
  const data = [
    p('2026-10-01', 74), p('2026-10-02', 74), p('2026-10-03', 74),
    p('2026-10-08', 73), p('2026-10-09', 73), p('2026-10-10', 73),
  ]

  it('media de 7 días ignora los días sin dato', () => {
    expect(windowMean(data, 'kg', '2026-10-10')).toBe(73)
    expect(windowMean(data, 'kg', '2026-10-03')).toBe(74)
  })

  it('la ventana de 7 días incluye el día final y excluye el octavo', () => {
    const pts = [p('2026-10-01', 80), p('2026-10-08', 70)]
    expect(windowMean(pts, 'kg', '2026-10-08')).toBe(70)
    expect(windowMean([p('2026-10-02', 80), p('2026-10-08', 70)], 'kg', '2026-10-08')).toBe(75)
  })

  it('tendencia: semana actual contra la anterior', () => {
    const t = trend(data, 'kg')!
    expect(t.current).toBe(73)
    expect(t.previous).toBe(74)
    expect(t.delta).toBe(-1)
    expect(t.pct).toBeCloseTo(-1.35, 1)
  })

  it('sin semana anterior no hay variación', () => {
    const t = trend([p('2026-10-10', 73)], 'kg')!
    expect(t.previous).toBeNull()
    expect(t.delta).toBeNull()
  })

  it('devuelve null si nunca se registró el campo', () => {
    expect(trend([p('2026-10-10', 73)], 'waist_cm')).toBeNull()
    expect(lastDate([p('2026-10-10', 73)], 'waist_cm')).toBeNull()
  })

  it('cintura y peso se siguen por separado', () => {
    const pts = [p('2026-10-01', 74, 85), p('2026-10-08', null, 84)]
    expect(trend(pts, 'waist_cm')!.delta).toBe(-1)
    expect(lastDate(pts, 'kg')).toBe('2026-10-01')
  })
})

describe('ritmo de pérdida', () => {
  const t = (pct: number | null) => ({ current: 0, previous: 0, delta: 0, pct })
  it('clasifica según el porcentaje semanal', () => {
    expect(paceVerdict(null)).toBe('sin-datos')
    expect(paceVerdict(t(null))).toBe('sin-datos')
    expect(paceVerdict(t(-1.5))).toBe('rapido')
    expect(paceVerdict(t(-0.5))).toBe('bien')
    expect(paceVerdict(t(-0.1))).toBe('lento')
    expect(paceVerdict(t(0.4))).toBe('sube')
  })
})
