import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CONFIG,
  cardioChoice,
  intervalSession,
  intervalWarnings,
  legHints,
  locate,
  nextInterval,
  recoveryWalk,
  totalSeconds,
} from './treadmill'

describe('protocolo de 20 min', () => {
  const segs = intervalSession(DEFAULT_CONFIG)
  it('dura exactamente 20 min', () => {
    expect(totalSeconds(segs)).toBe(1200)
  })
  it('calentamiento 5-6-7-8-9 km/h al 1 %', () => {
    expect(segs.slice(0, 5).map((s) => s.speed)).toEqual([5, 6, 7, 8, 9])
    expect(segs.slice(0, 5).every((s) => s.incline === 1 && s.sec === 60)).toBe(true)
  })
  it('bloques de 2/2/2/3 min a 9,5/9,5/10/10 km/h', () => {
    const fast = segs.filter((s) => s.kind === 'fast')
    expect(fast.map((s) => s.sec / 60)).toEqual([2, 2, 2, 3])
    expect(fast.map((s) => s.speed)).toEqual([9.5, 9.5, 10, 10])
  })
  it('cinco recuperaciones de 60 s a 5,5 km/h', () => {
    const rec = segs.filter((s) => s.kind === 'rec')
    expect(rec).toHaveLength(5)
    expect(rec.every((s) => s.sec === 60 && s.speed === 5.5)).toBe(true)
  })
  it('enfriamiento de 1 min a 4,5 km/h al 0 %', () => {
    expect(segs[segs.length - 1]).toMatchObject({ kind: 'cool', sec: 60, speed: 4.5, incline: 0 })
  })
  it('recuperación de 45 s acorta la sesión 75 s', () => {
    expect(totalSeconds(intervalSession({ ...DEFAULT_CONFIG, recoverySec: 45 }))).toBe(1200 - 75)
  })
})

describe('caminata suave', () => {
  it('15 min, de 1 a 5 % de inclinación', () => {
    const w = recoveryWalk()
    expect(totalSeconds(w)).toBe(900)
    expect(Math.max(...w.map((x) => x.incline))).toBe(5)
  })
  it('con piernas cargadas: máx. 2 % y 5,0 km/h, misma duración', () => {
    const w = recoveryWalk(true)
    expect(totalSeconds(w)).toBe(900)
    expect(Math.max(...w.map((x) => x.incline))).toBe(2)
    expect(Math.max(...w.map((x) => x.speed))).toBe(5)
  })
})

describe('locate', () => {
  it('encuentra el segmento por tiempo transcurrido', () => {
    const w = recoveryWalk()
    expect(locate(w, 0)).toEqual({ index: 0, left: 60 })
    expect(locate(w, 61)?.index).toBe(1)
    expect(locate(w, 900)).toBeNull()
  })
})

describe('progresión de una sola variable', () => {
  it('primera vez: configuración base', () => {
    expect(nextInterval(null).config).toEqual({ recoverySec: 60, lastBlockSpeed: 10 })
  })
  it('frase entera: la recuperación baja 15 s, hasta 30 s', () => {
    const a = nextInterval({ protocol: { recoverySec: 60 }, speech_test: 'entera', discomfort: false })
    expect(a.config.recoverySec).toBe(45)
    const b = nextInterval({ protocol: { recoverySec: 45 }, speech_test: 'entera', discomfort: false })
    expect(b.config.recoverySec).toBe(30)
    const c = nextInterval({ protocol: { recoverySec: 30 }, speech_test: 'entera', discomfort: false })
    expect(c.config.recoverySec).toBe(30)
  })
  it('frase partida en dos: repetir igual', () => {
    expect(nextInterval({ protocol: { recoverySec: 60 }, speech_test: 'dos', discomfort: false }).config).toEqual(DEFAULT_CONFIG)
  })
  it('no pasa de la mitad: baja 0,5 km/h el último bloque', () => {
    expect(nextInterval({ protocol: {}, speech_test: 'mitad', discomfort: false }).config.lastBlockSpeed).toBe(9.5)
  })
  it('molestia: sugiere caminata suave', () => {
    expect(nextInterval({ protocol: null, speech_test: 'entera', discomfort: true }).suggestSoft).toBe(true)
  })
})

describe('cardioChoice según las piernas', () => {
  it('frescas o normales: se mantiene el plan', () => {
    expect(cardioChoice('intervalos', 'frescas')).toEqual({ mode: 'intervalos', reduced: false })
    expect(cardioChoice('intervalos', 'normales')).toEqual({ mode: 'intervalos', reduced: false })
    expect(cardioChoice('recuperacion', 'normales')).toEqual({ mode: 'recuperacion', reduced: false })
  })
  it('cargadas: caminata suave reducida', () => {
    expect(cardioChoice('intervalos', 'cargadas')).toEqual({ mode: 'recuperacion', reduced: true })
    expect(cardioChoice('recuperacion', 'cargadas')).toEqual({ mode: 'recuperacion', reduced: true })
  })
})

describe('advertencias y datos informativos', () => {
  it('avisa si ayer hubo intervalos', () => {
    expect(intervalWarnings([{ date: '2026-10-05', kind: 'intervalos' }], '2026-10-06', '2026-10-01')).toHaveLength(1)
  })
  it('avisa si ya van 3 en los últimos 7 días', () => {
    const logs = ['2026-10-05', '2026-10-07', '2026-10-09'].map((date) => ({ date, kind: 'intervalos' }))
    expect(intervalWarnings(logs, '2026-10-11', '2026-10-05')).toHaveLength(1)
  })
  it('legHints solo informa', () => {
    expect(legHints({ yesterday: false, soreness: null })).toEqual([])
    expect(legHints({ yesterday: true, soreness: 9 })).toHaveLength(2)
  })
})
