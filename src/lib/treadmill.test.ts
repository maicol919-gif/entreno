import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CONFIG,
  LEVEL_MINUTES,
  buildSession,
  capLevel,
  cardioPhase,
  easyWalk,
  hardSession,
  intervalWarnings,
  kindOf,
  legHints,
  levelFor,
  levelMinutes,
  locate,
  mediumSession,
  nextInterval,
  nextMedium,
  totalSeconds,
  type Level,
  type Phase,
} from './treadmill'

const minutesOf = (level: Level, phase: Phase, reduced = false) => totalSeconds(buildSession(level, phase, DEFAULT_CONFIG, reduced)) / 60

describe('duraciones por nivel y fase (tabla acordada)', () => {
  it('dura: 20 / 25 / 30 min', () => {
    expect([0, 1, 2].map((p) => minutesOf('dura', p as Phase))).toEqual([20, 25, 30])
  })
  it('media: 25 / 28 / 30 min', () => {
    expect([0, 1, 2].map((p) => minutesOf('media', p as Phase))).toEqual([25, 28, 30])
  })
  it('suave: 30 / 35 / 40 min, también con piernas cargadas', () => {
    expect([0, 1, 2].map((p) => minutesOf('suave', p as Phase))).toEqual([30, 35, 40])
    expect([0, 1, 2].map((p) => minutesOf('suave', p as Phase, true))).toEqual([30, 35, 40])
  })
  it('la tabla coincide con LEVEL_MINUTES', () => {
    for (const l of ['dura', 'media', 'suave'] as Level[]) for (const p of [0, 1, 2] as Phase[]) expect(minutesOf(l, p)).toBe(levelMinutes(l, p))
    expect(LEVEL_MINUTES.dura).toEqual([20, 25, 30])
  })
})

describe('fases del ciclo', () => {
  it('semanas 1-2 fase 0, 3-4 fase 1, 5-6 fase 2', () => {
    expect([1, 2, 3, 4, 5, 6].map((w) => cardioPhase(w).phase)).toEqual([0, 0, 1, 1, 2, 2])
  })
  it('semana 7: descarga con duraciones de la fase 0; la 8 reinicia', () => {
    expect(cardioPhase(7)).toEqual({ phase: 0, deload: true })
    expect(cardioPhase(8)).toEqual({ phase: 0, deload: false })
    expect(cardioPhase(11).phase).toBe(1)
  })
})

describe('nivel DURA', () => {
  const p0 = hardSession(DEFAULT_CONFIG, 0)
  it('fase 0: tu protocolo de 20 min (calentamiento 5-9, bloques 2/2/2/3 a 9,5/9,5/10/10)', () => {
    expect(p0.slice(0, 5).map((s) => s.speed)).toEqual([5, 6, 7, 8, 9])
    const fast = p0.filter((s) => s.kind === 'fast')
    expect(fast.map((s) => s.sec / 60)).toEqual([2, 2, 2, 3])
    expect(fast.map((s) => s.speed)).toEqual([9.5, 9.5, 10, 10])
    expect(p0.filter((s) => s.kind === 'rec')).toHaveLength(5)
    expect(p0[p0.length - 1]).toMatchObject({ kind: 'cool', sec: 60, speed: 4.5, incline: 0 })
  })
  it('fase 1: bloques 3/3/3/5 min a las mismas velocidades', () => {
    const fast = hardSession(DEFAULT_CONFIG, 1).filter((s) => s.kind === 'fast')
    expect(fast.map((s) => s.sec / 60)).toEqual([3, 3, 3, 5])
    expect(fast.map((s) => s.speed)).toEqual([9.5, 9.5, 10, 10])
  })
  it('fase 2: 4 bloques de 4 min con recuperación de 2 min', () => {
    const segs = hardSession(DEFAULT_CONFIG, 2)
    expect(segs.filter((s) => s.kind === 'fast').map((s) => s.sec / 60)).toEqual([4, 4, 4, 4])
    expect(segs.filter((s) => s.kind === 'rec').every((s) => s.sec === 120)).toBe(true)
  })
  it('recuperación de 45 s acorta las fases 0 y 1 en 75 s', () => {
    const cfg = { ...DEFAULT_CONFIG, recoverySec: 45 }
    expect(totalSeconds(hardSession(cfg, 0))).toBe(1200 - 75)
    expect(totalSeconds(hardSession(cfg, 1))).toBe(1500 - 75)
  })
})

describe('nivel MEDIA', () => {
  it('3 bloques a la velocidad media con 2 min de recuperación', () => {
    const segs = mediumSession(DEFAULT_CONFIG, 0)
    const fast = segs.filter((s) => s.kind === 'fast')
    expect(fast).toHaveLength(3)
    expect(fast.every((s) => s.speed === 8.5)).toBe(true)
    expect(segs.filter((s) => s.kind === 'rec').every((s) => s.sec === 120)).toBe(true)
  })
  it('el calentamiento termina en la velocidad del bloque', () => {
    expect(mediumSession({ ...DEFAULT_CONFIG, mediumSpeed: 9 }, 0)[4].speed).toBe(9)
  })
})

describe('nivel SUAVE', () => {
  it('normal: tramo estable a 5,5 km/h al 3 %', () => {
    const w = easyWalk(30, false)
    expect(Math.max(...w.map((s) => s.speed))).toBe(5.5)
    expect(Math.max(...w.map((s) => s.incline))).toBe(3)
  })
  it('con piernas cargadas: máx. 2 % y 5,0 km/h', () => {
    const w = easyWalk(30, true)
    expect(Math.max(...w.map((s) => s.incline))).toBe(2)
    expect(Math.max(...w.map((s) => s.speed))).toBe(5)
  })
})

describe('elección del nivel', () => {
  it('piernas -> nivel', () => {
    expect(levelFor('frescas')).toBe('dura')
    expect(levelFor('normales')).toBe('media')
    expect(levelFor('cargadas')).toBe('suave')
  })
  it('el tope del día limita el nivel', () => {
    expect(capLevel('dura', 'media')).toBe('media')
    expect(capLevel('media', 'dura')).toBe('media')
    expect(capLevel('suave', 'media')).toBe('suave')
    expect(capLevel('dura', 'suave')).toBe('suave')
  })
  it('tipo guardado en la base de datos', () => {
    expect(kindOf('dura')).toBe('intervalos')
    expect(kindOf('media')).toBe('media')
    expect(kindOf('suave')).toBe('recuperacion')
  })
})

describe('locate', () => {
  it('encuentra el segmento por tiempo transcurrido', () => {
    const w = easyWalk(30, false)
    expect(locate(w, 0)).toEqual({ index: 0, left: 60 })
    expect(locate(w, 61)?.index).toBe(1)
    expect(locate(w, 1800)).toBeNull()
  })
})

describe('progresión nivel DURA (una sola variable)', () => {
  it('primera vez: configuración base', () => {
    expect(nextInterval(null).config).toEqual(DEFAULT_CONFIG)
  })
  it('frase entera: la recuperación baja 15 s, hasta 30 s', () => {
    expect(nextInterval({ protocol: { recoverySec: 60 }, speech_test: 'entera', discomfort: false }).config.recoverySec).toBe(45)
    expect(nextInterval({ protocol: { recoverySec: 45 }, speech_test: 'entera', discomfort: false }).config.recoverySec).toBe(30)
    expect(nextInterval({ protocol: { recoverySec: 30 }, speech_test: 'entera', discomfort: false }).config.recoverySec).toBe(30)
  })
  it('no pasa de la mitad: baja 0,5 km/h el último bloque', () => {
    expect(nextInterval({ protocol: {}, speech_test: 'mitad', discomfort: false }).config.lastBlockSpeed).toBe(9.5)
  })
  it('molestia: sugiere nivel suave', () => {
    expect(nextInterval({ protocol: null, speech_test: 'entera', discomfort: true }).suggestSoft).toBe(true)
  })
})

describe('progresión nivel MEDIA', () => {
  it('primera vez: 8,5 km/h', () => {
    expect(nextMedium(null).mediumSpeed).toBe(8.5)
  })
  it('entera sube 0,5; en dos mantiene; mitad baja 0,5', () => {
    const mk = (speech_test: 'entera' | 'dos' | 'mitad') => nextMedium({ protocol: { mediumSpeed: 8.5 }, speech_test, discomfort: false }).mediumSpeed
    expect(mk('entera')).toBe(9)
    expect(mk('dos')).toBe(8.5)
    expect(mk('mitad')).toBe(8)
  })
  it('respeta los límites 7,5-9,5', () => {
    expect(nextMedium({ protocol: { mediumSpeed: 9.5 }, speech_test: 'entera', discomfort: false }).mediumSpeed).toBe(9.5)
    expect(nextMedium({ protocol: { mediumSpeed: 7.5 }, speech_test: 'mitad', discomfort: false }).mediumSpeed).toBe(7.5)
  })
  it('molestia: sugiere nivel suave', () => {
    expect(nextMedium({ protocol: null, speech_test: null, discomfort: true }).suggestSoft).toBe(true)
  })
})

describe('advertencias y datos informativos', () => {
  it('avisa si ayer hubo intervalos duros', () => {
    expect(intervalWarnings([{ date: '2026-10-05', kind: 'intervalos' }], '2026-10-06', '2026-10-01')).toHaveLength(1)
  })
  it('una sesión media ayer no bloquea', () => {
    expect(intervalWarnings([{ date: '2026-10-05', kind: 'media' }], '2026-10-06', '2026-10-01')).toHaveLength(0)
  })
  it('avisa si ya van 3 duras en los últimos 7 días', () => {
    const logs = ['2026-10-05', '2026-10-07', '2026-10-09'].map((date) => ({ date, kind: 'intervalos' }))
    expect(intervalWarnings(logs, '2026-10-11', '2026-10-05')).toHaveLength(1)
  })
  it('legHints solo informa', () => {
    expect(legHints({ yesterday: false, soreness: null })).toEqual([])
    expect(legHints({ yesterday: true, soreness: 9 })).toHaveLength(2)
  })
})
