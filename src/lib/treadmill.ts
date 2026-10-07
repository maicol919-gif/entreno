/**
 * Protocolo de cinta (capacidad respiratoria), 20 min, todo a 1 % salvo el último minuto (0 %):
 * - Calentamiento de 5 min subiendo 1 km/h por minuto (5 -> 9).
 * - 4 bloques rápidos: 2 min a 9,5 · 2 min a 9,5 · 2 min a 10,0 · 3 min a 10,0.
 * - Recuperaciones a 5,5 km/h (60 s) antes de cada bloque y tras el último.
 * - Enfriamiento: 1 min a 4,5 km/h al 0 %.
 * - Se cambia UNA sola variable por sesión (recuperación o velocidad del último bloque).
 * - Test de habla al final de la última recuperación.
 */

export type SegKind = 'warm' | 'fast' | 'rec' | 'cool'

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
  /** velocidad del 4.º bloque (10,0 por defecto; baja 0,5 si el test de habla no pasa de la mitad) */
  lastBlockSpeed: number
}

export const DEFAULT_CONFIG: IntervalConfig = { recoverySec: 60, lastBlockSpeed: 10.0 }
export const MIN_RECOVERY_SEC = 30

export const SPEECH_PHRASE = 'Hoy es viernes y estoy terminando el último bloque.'

const REC_SPEED = 5.5

export function intervalSession(cfg: IntervalConfig): Segment[] {
  const seg = (label: string, sec: number, speed: number, incline: number, kind: SegKind): Segment => ({ label, sec, speed, incline, kind })
  const out: Segment[] = []
  for (const speed of [5, 6, 7, 8, 9]) out.push(seg('Calentamiento', 60, speed, 1, 'warm'))
  const blocks: [number, number][] = [
    [120, 9.5],
    [120, 9.5],
    [120, 10.0],
    [180, cfg.lastBlockSpeed],
  ]
  blocks.forEach(([sec, speed], i) => {
    out.push(seg(i === 0 ? 'Recuperación antes del bloque 1' : `Recuperación ${i}`, cfg.recoverySec, REC_SPEED, 1, 'rec'))
    out.push(seg(`Bloque ${i + 1}`, sec, speed, 1, 'fast'))
  })
  out.push(seg('Última recuperación (test de habla)', cfg.recoverySec, REC_SPEED, 1, 'rec'))
  out.push(seg('Enfriamiento', 60, 4.5, 0, 'cool'))
  return out
}

/** Día suave: caminata en cuesta de 15 min, frases completas todo el rato. */
export function recoveryWalk(reduced = false): Segment[] {
  // con piernas cargadas: inclinación máxima 2 % y velocidad máxima 5,0 km/h
  const s = (min: number, speed: number, incline: number): Segment => {
    const inc = reduced ? Math.min(incline, 2) : incline
    return { label: `Cuesta ${inc} %`, sec: min * 60, speed: reduced ? Math.min(speed, 5.0) : speed, incline: inc, kind: 'rec' }
  }
  return [s(1, 4.5, 1), s(2, 4.5, 2), s(2, 5.0, 3), s(3, 5.5, 4), s(3, 5.5, 5), s(2, 5.0, 3), s(2, 4.5, 1)]
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
export type LegsFeel = 'frescas' | 'normales' | 'cargadas'

export interface LastInterval {
  protocol: Partial<IntervalConfig> | null
  speech_test: SpeechTest | null
  discomfort: boolean
}

export interface NextInterval {
  config: IntervalConfig
  message: string
  /** true si conviene cambiar a la caminata suave (molestia en la última sesión) */
  suggestSoft: boolean
}

/** Decide la configuración de la próxima sesión de intervalos. Una sola variable por sesión. */
export function nextInterval(last: LastInterval | null): NextInterval {
  if (!last) {
    return {
      config: DEFAULT_CONFIG,
      message:
        'Tu protocolo de 20 min: calentamiento 5→9 km/h, bloques de 2/2/2/3 min a 9,5-10 km/h y recuperaciones de 60 s a 5,5 km/h. Al final, test de habla.',
      suggestSoft: false,
    }
  }
  const prev: IntervalConfig = { ...DEFAULT_CONFIG, ...last.protocol }
  if (last.discomfort) {
    return {
      config: prev,
      message: 'La última sesión dejó molestia (tobillo/tendón). Hoy mejor caminata suave; si haces intervalos, mismos parámetros que la vez pasada.',
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

/**
 * Tipo de cardio según cómo sientes las piernas hoy.
 * - Día de intervalos: piernas cargadas -> caminata suave con inclinación reducida; frescas o normales -> intervalos.
 * - Día suave: la caminata es la misma, pero con piernas cargadas se reduce inclinación y velocidad.
 */
export function cardioChoice(planKind: 'intervalos' | 'recuperacion', feel: LegsFeel): { mode: 'intervalos' | 'recuperacion'; reduced: boolean } {
  if (feel === 'cargadas') return { mode: 'recuperacion', reduced: true }
  return { mode: planKind, reduced: false }
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

/** Advertencias de las reglas de descanso: un día entre intervalos y no más de 3 en 7 días. */
export function intervalWarnings(logs: PastCardio[], today: string, sinceISO: string): string[] {
  const out: string[] = []
  const intervals = logs.filter((l) => l.kind === 'intervalos').map((l) => l.date)
  if (intervals.includes(addDays(today, -1))) {
    out.push('Ayer hiciste intervalos. Deja al menos un día entre sesiones: hoy caminata suave o descanso (riesgo de tendinitis de tobillo antes que estancamiento).')
  }
  if (intervals.filter((d) => d >= sinceISO && d < today).length >= 3) {
    out.push('Ya llevas 3 sesiones de intervalos en los últimos 7 días: hoy descansa o camina suave.')
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
