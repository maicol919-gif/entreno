import { describe, expect, it } from 'vitest'
import {
  MAX_LAST_BLOCK,
  STABLE_SESSIONS,
  compactHard,
  compactMedium,
  MIN_CARDIO_MIN,
  speechWindow,
  DEFAULT_CONFIG,
  LEVEL_MINUTES,
  buildSession,
  capLevel,
  cardioPhase,
  discomfortHold,
  easyWalk,
  hardSession,
  intervalWarnings,
  kindOf,
  legHints,
  levelFor,
  levelMinutes,
  locate,
  matchCap,
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
  it('fase 2: 4 bloques de 4 min con recuperación de 2 min y descanso antes del primer bloque', () => {
    const segs = hardSession(DEFAULT_CONFIG, 2)
    expect(segs.filter((s) => s.kind === 'fast').map((s) => s.sec / 60)).toEqual([4, 4, 4, 4])
    expect(segs.slice(0, 4).map((x) => x.speed)).toEqual([5, 6, 7, 8])
    expect(segs[4]).toMatchObject({ kind: 'rec', speed: 5.5, sec: 60 })
    const rest = segs.filter((s) => s.kind === 'rec').slice(1)
    expect(rest.every((s) => s.sec === 120)).toBe(true)
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
    expect(segs.filter((s) => s.kind === 'rec').slice(1).every((s) => s.sec === 120)).toBe(true)
  })
  it('calentamiento 5-6-7-8 y recuperación a 5,5 antes del primer bloque (no termina a la velocidad del bloque)', () => {
    const segs = mediumSession(DEFAULT_CONFIG, 0)
    expect(segs.slice(0, 4).map((x) => x.speed)).toEqual([5, 6, 7, 8])
    expect(segs[4]).toMatchObject({ kind: 'rec', speed: 5.5, sec: 60 })
    expect(segs[5]).toMatchObject({ kind: 'fast', speed: 8.5 })
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
  it('la molestia ya no bloquea aquí: la regla es global (discomfortHold)', () => {
    expect(nextInterval({ protocol: null, speech_test: 'dos', discomfort: true }).suggestSoft).toBe(false)
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
  it('la molestia ya no bloquea aquí: la regla es global (discomfortHold)', () => {
    expect(nextMedium({ protocol: null, speech_test: null, discomfort: true }).suggestSoft).toBe(false)
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

describe('pausa por molestia', () => {
  const log = (discomfort: boolean, phase?: number, severity?: 'leve' | 'moderada' | 'fuerte', resolved = false) => ({
    date: '2026-10-10',
    discomfort,
    severity,
    resolved,
    protocol: phase == null ? null : { phase },
  })
  it('sin molestias registradas: sin pausa', () => {
    expect(discomfortHold([log(false), log(false)]).active).toBe(false)
  })
  it('molestia moderada (o sin gravedad guardada) en la última sesión: pausa hasta 1 sesión sin molestia', () => {
    expect(discomfortHold([log(true, 1, 'moderada'), log(false)])).toMatchObject({ active: true, painFree: 0, need: 1, phase: 1 })
    expect(discomfortHold([log(true)]).need).toBe(1)
    expect(discomfortHold([log(false), log(true, 1, 'moderada')]).active).toBe(false)
  })
  it('molestia fuerte: hacen falta 2 sesiones sin molestia', () => {
    expect(discomfortHold([log(false), log(true, 2, 'fuerte')])).toMatchObject({ active: true, painFree: 1, need: 2, phase: 2 })
    expect(discomfortHold([log(false), log(false), log(true, 0, 'fuerte')]).active).toBe(false)
  })
  it('molestia leve: se levanta al confirmar que ya no está, sin esperar otra sesión', () => {
    const pending = discomfortHold([log(true, 1, 'leve')])
    expect(pending).toMatchObject({ active: true, canResolve: true })
    const confirmed = discomfortHold([log(true, 1, 'leve', true)])
    expect(confirmed.active).toBe(false)
    expect(confirmed.canResolve).toBe(false)
  })
  it('solo las molestias leves permiten la pregunta "¿sigue?"', () => {
    expect(discomfortHold([log(true, 0, 'moderada')]).canResolve).toBe(false)
    expect(discomfortHold([log(true, 0, 'fuerte')]).canResolve).toBe(false)
  })
  it('tu caso: molestia el 13 (sin gravedad guardada), luego 3 sesiones sin molestia -> sin pausa', () => {
    expect(discomfortHold([log(false), log(false), log(false), log(true)]).active).toBe(false)
  })
  it('sin fase guardada (versión anterior) cuenta como fase 0', () => {
    expect(discomfortHold([log(true)]).phase).toBe(0)
  })
})

describe('partido cerca', () => {
  it('hoy o mañana: solo suave; sin partido: sin tope', () => {
    expect(matchCap('hoy')).toBe('suave')
    expect(matchCap('manana')).toBe('suave')
    expect(matchCap('no')).toBe('dura')
  })
  it('combina con el tope del día', () => {
    expect(capLevel(capLevel('media', 'dura'), matchCap('no'))).toBe('media')
    expect(capLevel(capLevel('dura', 'media'), matchCap('manana'))).toBe('suave')
  })
})

describe('speechWindow', () => {
  it('intervalos: últimos 15 s de la última recuperación', () => {
    const segs = hardSession({ recoverySec: 45, lastBlockSpeed: 10, mediumSpeed: 8.5 }, 0)
    const w = speechWindow(segs)!
    const lastRec = segs[segs.length - 2]
    const end = segs.slice(0, -1).reduce((a, s) => a + s.sec, 0)
    expect(lastRec.label).toContain('test de habla')
    expect(w.to).toBe(end)
    expect(w.to - w.from).toBe(15)
  })
  it('recuperación de 30 s: ventana de 15 s, nunca antes de los 10 s caminando', () => {
    const segs = hardSession({ recoverySec: 30, lastBlockSpeed: 10, mediumSpeed: 8.5 }, 0)
    const w = speechWindow(segs)!
    expect(w.to - w.from).toBe(15)
  })
  it('media: último minuto del último bloque', () => {
    const w = speechWindow(mediumSession({ recoverySec: 60, lastBlockSpeed: 10, mediumSpeed: 8.5 }, 0))!
    expect(w.to - w.from).toBe(60)
  })
  it('suave: sin test', () => {
    expect(speechWindow(easyWalk(30, false))).toBeNull()
  })
})

describe('sesiones cortas', () => {
  const cfg = { recoverySec: 45, lastBlockSpeed: 10, mediumSpeed: 8.5 }
  it('dura: el total es exactamente el tiempo pedido y nunca pasa de 10 km/h', () => {
    for (const m of [10, 12, 15, 18, 19]) {
      const segs = compactHard(cfg, m)
      expect(segs.reduce((a, s) => a + s.sec, 0)).toBe(m * 60)
      expect(Math.max(...segs.map((s) => s.speed))).toBeLessThanOrEqual(10)
      expect(segs.some((s) => s.label.includes('test de habla'))).toBe(true)
      expect(segs[segs.length - 1].kind).toBe('cool')
    }
  })
  it('dura: con 10 min caben 2 bloques a 10 km/h y al último bloque configurado; el calentamiento sube progresivamente', () => {
    const segs = compactHard(cfg, 10)
    expect(segs.filter((s) => s.kind === 'fast').map((s) => s.speed)).toEqual([10, 10])
    expect(segs.filter((s) => s.kind === 'warm').map((s) => s.speed)).toEqual([5, 6, 7])
  })
  it('media: total exacto, test de habla en el último bloque', () => {
    for (const m of [10, 12, 15, 20, 24]) {
      const segs = compactMedium(cfg, m)
      expect(segs.reduce((a, s) => a + s.sec, 0)).toBe(m * 60)
      expect(segs.filter((s) => s.kind === 'fast').pop()!.label).toContain('test de habla')
    }
  })
  it('buildSession: sin límite o con tiempo de sobra devuelve la sesión completa', () => {
    const full = buildSession('dura', 0, cfg, false, null)
    expect(buildSession('dura', 0, cfg, false, 60)).toEqual(full)
    expect(buildSession('dura', 0, cfg, false, 20).reduce((a, s) => a + s.sec, 0)).toBe(full.reduce((a, s) => a + s.sec, 0))
  })
  it('suave: la caminata se acorta al tiempo pedido', () => {
    expect(buildSession('suave', 0, cfg, false, MIN_CARDIO_MIN).reduce((a, s) => a + s.sec, 0)).toBe(MIN_CARDIO_MIN * 60)
  })
})

describe('subir el último bloque más allá de 10 km/h', () => {
  const at = (speed: number, discomfort = false, speech: 'entera' | 'dos' | 'mitad' = 'entera') => ({ protocol: { recoverySec: 30, lastBlockSpeed: speed }, speech_test: speech, discomfort })
  it('con 3 sesiones estables sube 0,5 km/h', () => {
    const recent = [at(10), at(10), at(10)]
    expect(nextInterval(recent[0], recent).config.lastBlockSpeed).toBe(10.5)
  })
  it('con menos de 3 sesiones estables no sube y dice cuántas lleva', () => {
    const recent = [at(10), at(10)]
    const n = nextInterval(recent[0], recent)
    expect(n.config.lastBlockSpeed).toBe(10)
    expect(n.message).toContain('2 de ' + STABLE_SESSIONS)
  })
  it('una molestia en las últimas 3 lo impide', () => {
    const recent = [at(10), at(10, true), at(10)]
    expect(nextInterval(recent[0], recent).config.lastBlockSpeed).toBe(10)
  })
  it('después de subir hay que volver a acumular 3 sesiones a la nueva velocidad', () => {
    const recent = [at(10.5), at(10), at(10)]
    expect(nextInterval(recent[0], recent).config.lastBlockSpeed).toBe(10.5)
  })
  it('no pasa del máximo y baja si el habla no pasa de la mitad', () => {
    const top = [at(MAX_LAST_BLOCK), at(MAX_LAST_BLOCK), at(MAX_LAST_BLOCK)]
    expect(nextInterval(top[0], top).config.lastBlockSpeed).toBe(MAX_LAST_BLOCK)
    expect(nextInterval(at(10.5, false, 'mitad'), [at(10.5, false, 'mitad')]).config.lastBlockSpeed).toBe(10)
  })
})
