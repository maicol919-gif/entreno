/**
 * Cardio en cinta (capacidad respiratoria + gasto energético). Tres niveles que se eligen según cómo estén las piernas:
 *
 * - DURA  (frescas)  : intervalos a 9,5-10 km/h, RPE 8-9. Crece 20 -> 25 -> 30 min alargando los bloques, no la velocidad.
 * - MEDIA (normales) : bloques continuos a ~8,5 km/h, RPE 6-7 (frases cortas). 25 -> 28 -> 30 min.
 * - SUAVE (cargadas) : caminata continua en cuesta, RPE 3-4 (frases completas). 30 -> 35 -> 40 min.
 *
 * Fases por ciclo de 7 semanas: semanas 1-2 = fase 0, 3-4 = fase 1, 5-6 = fase 2, 7 = descarga (vuelve a la duración de la fase 0).
 * Se cambia UNA sola variable por sesión. Test de habla al final.
 */
import { CYCLE_LENGTH } from './plan'

export type SegKind = 'warm' | 'fast' | 'rec' | 'cool'
export type Level = 'dura' | 'media' | 'suave'
export type Phase = 0 | 1 | 2

export interface Segment {
  label: string
  sec: number
  speed: number
  incline: number
  kind: SegKind
}

export interface IntervalConfig {
  /** segundos de cada recuperación (60 por defecto; baja 15 s cuando el test de habla sale "entera") */
  recoverySec: number
  /** velocidad del último bloque duro (10,0 por defecto; baja 0,5 si el test de habla no pasa de la mitad) */
  lastBlockSpeed: number
  /** velocidad de los bloques del nivel media (8,5 por defecto; se ajusta 0,5 según el test de habla) */
  mediumSpeed: number
}

export const DEFAULT_CONFIG: IntervalConfig = { recoverySec: 60, lastBlockSpeed: 10.0, mediumSpeed: 8.5 }
export const MIN_RECOVERY_SEC = 30
export const MEDIUM_SPEED_RANGE: [number, number] = [7.5, 9.5]

export const SPEECH_PHRASE = 'Hoy es viernes y estoy terminando el último bloque.'

const REC_SPEED = 5.5

export const LEVEL_MINUTES: Record<Level, [number, number, number]> = {
  dura: [20, 25, 30],
  media: [25, 28, 30],
  suave: [30, 35, 40],
}

export const LEVEL_LABEL: Record<Level, string> = { dura: 'Dura', media: 'Media', suave: 'Suave' }

const ORDER: Level[] = ['suave', 'media', 'dura']

/** Fase del cardio según la semana del ciclo (la descarga vuelve a la duración de la fase 0). */
export function cardioPhase(week: number): { phase: Phase; deload: boolean } {
  const cw = ((week - 1) % CYCLE_LENGTH) + 1
  if (cw === CYCLE_LENGTH) return { phase: 0, deload: true }
  return { phase: Math.min(2, Math.floor((cw - 1) / 2)) as Phase, deload: false }
}

export function levelMinutes(level: Level, phase: Phase): number {
  return LEVEL_MINUTES[level][phase]
}

export type LegsFeel = 'frescas' | 'normales' | 'cargadas'

/** Nivel según cómo sientes las piernas: frescas -> dura, normales -> media, cargadas -> suave. */
export function levelFor(feel: LegsFeel): Level {
  return feel === 'frescas' ? 'dura' : feel === 'normales' ? 'media' : 'suave'
}

/** Limita un nivel al tope del día (p. ej. en días de pierna nunca "dura"). */
export function capLevel(level: Level, cap: Level): Level {
  return ORDER[Math.min(ORDER.indexOf(level), ORDER.indexOf(cap))]
}

/** Tipo que se guarda en la base de datos. */
export function kindOf(level: Level): 'intervalos' | 'media' | 'recuperacion' {
  return level === 'dura' ? 'intervalos' : level === 'media' ? 'media' : 'recuperacion'
}

const seg = (label: string, sec: number, speed: number, incline: number, kind: SegKind): Segment => ({ label, sec, speed, incline, kind })

function cooldown(): Segment {
  return seg('Enfriamiento', 60, 4.5, 0, 'cool')
}

/**
 * DURA. Fases 0 y 1: calentamiento 5->9, recuperación, bloques (2/2/2/3 o 3/3/3/5 min) con recuperación entre ellos,
 * última recuperación (test de habla) y enfriamiento. Fase 2: 4 bloques de 4 min con recuperación de 2 min.
 */
export function hardSession(cfg: IntervalConfig, phase: Phase): Segment[] {
  const out: Segment[] = []
  for (const speed of [5, 6, 7, 8, 9]) out.push(seg('Calentamiento', 60, speed, 1, 'warm'))
  const speeds = [9.5, 9.5, 10.0, cfg.lastBlockSpeed]
  if (phase === 2) {
    speeds.forEach((v, i) => {
      out.push(seg(`Bloque ${i + 1}`, 240, v, 1, 'fast'))
      out.push(seg(i === 3 ? 'Última recuperación (test de habla)' : `Recuperación ${i + 1}`, 120, REC_SPEED, 1, 'rec'))
    })
  } else {
    const blocks = phase === 0 ? [120, 120, 120, 180] : [180, 180, 180, 300]
    blocks.forEach((sec, i) => {
      out.push(seg(i === 0 ? 'Recuperación antes del bloque 1' : `Recuperación ${i}`, cfg.recoverySec, REC_SPEED, 1, 'rec'))
      out.push(seg(`Bloque ${i + 1}`, sec, speeds[i], 1, 'fast'))
    })
    out.push(seg('Última recuperación (test de habla)', cfg.recoverySec, REC_SPEED, 1, 'rec'))
  }
  out.push(cooldown())
  return out
}

/** MEDIA. Calentamiento 5 min hasta la velocidad del bloque, 3 bloques continuos con 2 min de recuperación, enfriamiento. */
export function mediumSession(cfg: IntervalConfig, phase: Phase): Segment[] {
  const out: Segment[] = []
  const v = cfg.mediumSpeed
  for (const speed of [5, 6, 7, 8, v]) out.push(seg('Calentamiento', 60, speed, 1, 'warm'))
  const blocks = phase === 0 ? [300, 300, 300] : phase === 1 ? [360, 360, 360] : [420, 420, 360]
  blocks.forEach((sec, i) => {
    out.push(seg(i === blocks.length - 1 ? `Bloque ${i + 1} (test de habla en el último minuto)` : `Bloque ${i + 1}`, sec, v, 1, 'fast'))
    if (i < blocks.length - 1) out.push(seg(`Recuperación ${i + 1}`, 120, REC_SPEED, 1, 'rec'))
  })
  out.push(cooldown())
  return out
}

/**
 * SUAVE. Caminata continua en cuesta: 1 min 4,5/1 %, 2 min 5,0/2 %, tramo estable 5,5 km/h al 3 %, 3 min 5,0/2 %, 3 min 4,5/1 %.
 * Con piernas cargadas: inclinación máx. 2 % y velocidad máx. 5,0 km/h.
 */
export function easyWalk(minutes: number, reduced: boolean): Segment[] {
  const s = (sec: number, speed: number, incline: number): Segment => {
    const inc = reduced ? Math.min(incline, 2) : incline
    return seg(`Cuesta ${inc} %`, sec, reduced ? Math.min(speed, 5.0) : speed, inc, 'rec')
  }
  const steady = Math.max(60, minutes * 60 - 540)
  return [s(60, 4.5, 1), s(120, 5.0, 2), s(steady, 5.5, 3), s(180, 5.0, 2), s(180, 4.5, 1)]
}

export function buildSession(level: Level, phase: Phase, cfg: IntervalConfig, reduced: boolean): Segment[] {
  if (level === 'dura') return hardSession(cfg, phase)
  if (level === 'media') return mediumSession(cfg, phase)
  return easyWalk(levelMinutes('suave', phase), reduced)
}

export function totalSeconds(segs: Segment[]): number {
  return segs.reduce((a, s) => a + s.sec, 0)
}

/** Segmento activo y segundos restantes en él a partir del tiempo transcurrido. */
export function locate(segs: Segment[], elapsed: number): { index: number; left: number } | null {
  let acc = 0
  for (let i = 0; i < segs.length; i++) {
    if (elapsed < acc + segs[i].sec) return { index: i, left: acc + segs[i].sec - elapsed }
    acc += segs[i].sec
  }
  return null
}

export type SpeechTest = 'entera' | 'dos' | 'mitad'

export interface LastInterval {
  protocol: Partial<IntervalConfig> | null
  speech_test: SpeechTest | null
  discomfort: boolean
}

export interface NextInterval {
  config: IntervalConfig
  message: string
  /** true si conviene cambiar a un nivel suave (molestia en la última sesión) */
  suggestSoft: boolean
}

/** Configuración de la próxima sesión DURA. Una sola variable por sesión. */
export function nextInterval(last: LastInterval | null): NextInterval {
  if (!last) {
    return {
      config: DEFAULT_CONFIG,
      message: 'Intervalos duros: calentamiento 5→9 km/h, bloques a 9,5-10 km/h y recuperaciones a 5,5 km/h. Al final, test de habla.',
      suggestSoft: false,
    }
  }
  const prev: IntervalConfig = { ...DEFAULT_CONFIG, ...last.protocol }
  if (last.discomfort) {
    return {
      config: prev,
      message: 'La última sesión dejó molestia (tobillo/tendón). Hoy mejor un nivel suave; si haces intervalos, mismos parámetros que la vez pasada.',
      suggestSoft: true,
    }
  }
  if (last.speech_test === 'mitad') {
    const v = Math.max(9.0, Math.round((prev.lastBlockSpeed - 0.5) * 10) / 10)
    return {
      config: { ...prev, lastBlockSpeed: v },
      message: `Test de habla: no pasaste de la mitad. Baja el último bloque a ${v.toFixed(1)} km/h; el resto igual.`,
      suggestSoft: false,
    }
  }
  if (last.speech_test === 'entera' && prev.recoverySec > MIN_RECOVERY_SEC) {
    const r = Math.max(MIN_RECOVERY_SEC, prev.recoverySec - 15)
    return {
      config: { ...prev, recoverySec: r },
      message: `Frase entera de un tirón: recorta la recuperación a ${r} s. Mismas velocidades; NO subas velocidad a la vez.`,
      suggestSoft: false,
    }
  }
  if (last.speech_test === 'entera') {
    return {
      config: prev,
      message: `Frase entera con recuperación de ${prev.recoverySec} s: repite la sesión. Más adelante decidimos la siguiente variable (una sola).`,
      suggestSoft: false,
    }
  }
  return {
    config: prev,
    message: last.speech_test === 'dos' ? 'Frase partida en dos: nivel correcto, repite.' : 'Repite la misma sesión y haz el test de habla al final.',
    suggestSoft: false,
  }
}

export interface NextMedium {
  mediumSpeed: number
  message: string
  suggestSoft: boolean
}

/**
 * Velocidad de la próxima sesión MEDIA según el test de habla del último bloque:
 * entera = demasiado fácil (+0,5 km/h), en dos = correcto (igual), no pasa de la mitad = demasiado duro (-0,5 km/h).
 */
export function nextMedium(last: LastInterval | null): NextMedium {
  const base = DEFAULT_CONFIG.mediumSpeed
  if (!last) {
    return { mediumSpeed: base, message: `Bloques continuos a ${base.toFixed(1)} km/h (esfuerzo 6-7: frases cortas). Test de habla en el último bloque.`, suggestSoft: false }
  }
  const prev = last.protocol?.mediumSpeed ?? base
  const [lo, hi] = MEDIUM_SPEED_RANGE
  if (last.discomfort) {
    return { mediumSpeed: prev, message: 'La última sesión dejó molestia. Hoy mejor un nivel suave; si haces la media, misma velocidad.', suggestSoft: true }
  }
  if (last.speech_test === 'entera') {
    const v = Math.min(hi, prev + 0.5)
    return { mediumSpeed: v, message: `Frase entera: estaba fácil. Sube a ${v.toFixed(1)} km/h.`, suggestSoft: false }
  }
  if (last.speech_test === 'mitad') {
    const v = Math.max(lo, prev - 0.5)
    return { mediumSpeed: v, message: `No pasaste de la mitad: estaba duro. Baja a ${v.toFixed(1)} km/h.`, suggestSoft: false }
  }
  return {
    mediumSpeed: prev,
    message: last.speech_test === 'dos' ? `Frase partida en dos: correcto. Repite a ${prev.toFixed(1)} km/h.` : `Repite a ${prev.toFixed(1)} km/h y haz el test de habla en el último bloque.`,
    suggestSoft: false,
  }
}

export interface PastCardio {
  date: string
  kind: string
}

function addDays(iso: string, delta: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + delta)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Advertencias de las reglas de descanso para el nivel DURO: un día entre sesiones y no más de 3 en 7 días. */
export function intervalWarnings(logs: PastCardio[], today: string, sinceISO: string): string[] {
  const out: string[] = []
  const intervals = logs.filter((l) => l.kind === 'intervalos').map((l) => l.date)
  if (intervals.includes(addDays(today, -1))) {
    out.push('Ayer hiciste intervalos duros. Deja al menos un día entre sesiones duras: hoy un nivel suave o descanso (riesgo de tendinitis de tobillo antes que estancamiento).')
  }
  if (intervals.filter((d) => d >= sinceISO && d < today).length >= 3) {
    out.push('Ya llevas 3 sesiones duras en los últimos 7 días: hoy un nivel suave o descanso.')
  }
  return out
}

export interface LegContext {
  /** ayer hubo sesión de pierna */
  yesterday: boolean
  /** agujetas (0-10) de la última sesión de pierna de los últimos 3 días, si las registraste */
  soreness: number | null
}

/** Datos informativos para ayudarte a responder "¿cómo sientes las piernas hoy?" (no deciden nada solos). */
export function legHints(ctx: LegContext): string[] {
  const out: string[] = []
  if (ctx.yesterday) out.push('Ayer entrenaste pierna.')
  if (ctx.soreness != null) out.push(`Anotaste agujetas de ${ctx.soreness}/10 en tu última sesión de pierna (hace menos de 3 días).`)
  return out
}

/** Etiquetas de esfuerzo con el valor que se guarda (escala 1-10 de esfuerzo percibido). */
export const EFFORT_LEVELS: { label: string; hint: string; value: number }[] = [
  { label: 'Muy fácil', hint: 'casi no lo noté', value: 2 },
  { label: 'Fácil', hint: 'podía hablar sin problema', value: 3 },
  { label: 'Moderado', hint: 'respiración alta pero controlada', value: 5 },
  { label: 'Duro', hint: 'frases cortas, me costó', value: 7 },
  { label: 'Máximo', hint: 'al límite', value: 9 },
]
