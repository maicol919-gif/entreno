/**
 * Protocolo de cinta (capacidad respiratoria):
 * - Intervalos: 4 bloques rápidos de 2 min (9,5 / 9,5 / 10,0 / 10,0 km/h), inclinación 1 %, recuperación a 5,5 km/h.
 * - Calentamiento y enfriamiento a 0 %.
 * - Se cambia UNA sola variable por sesión. Siguiente paso: recuperación 45 s -> 30 s con las mismas velocidades.
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
  /** 'basic' = 3 min (5,5/6,5/7,5); 'extended' = calentamiento ampliado con puente a 8,5 */
  warmup: 'basic' | 'extended'
  recoverySec: number
  /** velocidad del 4.º bloque (10,0 por defecto; baja 0,5 si el test de habla no pasa de la mitad) */
  lastBlockSpeed: number
}

export const DEFAULT_CONFIG: IntervalConfig = { warmup: 'extended', recoverySec: 45, lastBlockSpeed: 10.0 }

export const SPEECH_PHRASE = 'Hoy es viernes y estoy terminando el último bloque.'

const REC_SPEED = 5.5

export function intervalSession(cfg: IntervalConfig): Segment[] {
  const seg = (label: string, sec: number, speed: number, incline: number, kind: SegKind): Segment => ({ label, sec, speed, incline, kind })
  const out: Segment[] = []
  if (cfg.warmup === 'basic') {
    out.push(seg('Calentamiento', 60, 5.5, 0, 'warm'), seg('Calentamiento', 60, 6.5, 0, 'warm'), seg('Calentamiento', 60, 7.5, 0, 'warm'))
  } else {
    out.push(
      seg('Calentamiento', 90, 5.5, 0, 'warm'),
      seg('Calentamiento', 90, 7.0, 0, 'warm'),
      seg('Puente', 60, 8.5, 0, 'warm'),
      seg('Recuperación antes del bloque 1', 30, 5.5, 1, 'rec'),
    )
  }
  const speeds = [9.5, 9.5, 10.0, cfg.lastBlockSpeed]
  speeds.forEach((v, i) => {
    out.push(seg(`Bloque ${i + 1}`, 120, v, 1, 'fast'))
    if (i < speeds.length - 1) out.push(seg(`Recuperación ${i + 1}`, cfg.recoverySec, REC_SPEED, 1, 'rec'))
  })
  out.push(seg('Enfriamiento', 60, 5.0, 0, 'cool'), seg('Enfriamiento', 45, 4.5, 0, 'cool'))
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

/**
 * Decide la configuración de la próxima sesión de intervalos. Una sola variable por sesión:
 * 1) calentamiento ampliado (ajuste acordado) y después 2) recuperación 45 s -> 30 s.
 */
export function nextInterval(last: LastInterval | null): NextInterval {
  if (!last) {
    return {
      config: DEFAULT_CONFIG,
      message: 'Primera sesión con el calentamiento ampliado (ajuste acordado). Recuperación 45 s y velocidades iguales: no cambies nada más.',
      suggestSoft: false,
    }
  }
  const prev: IntervalConfig = { ...DEFAULT_CONFIG, warmup: 'basic', ...last.protocol }
  if (last.discomfort) {
    return {
      config: prev,
      message: 'La última sesión dejó molestia (tobillo/tendón). Hoy mejor caminata suave; si haces intervalos, mismos parámetros que la vez pasada.',
      suggestSoft: true,
    }
  }
  if (prev.warmup === 'basic') {
    return {
      config: { ...prev, warmup: 'extended' },
      message: 'Aplicar el calentamiento ampliado (el primer bloque era el que más costaba). Es la única variable que cambia hoy.',
      suggestSoft: false,
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
  if (last.speech_test === 'entera' && prev.recoverySec > 30) {
    return {
      config: { ...prev, recoverySec: 30 },
      message: 'Frase entera de un tirón: recorta la recuperación a 30 s. Mismas velocidades; NO subas velocidad a la vez.',
      suggestSoft: false,
    }
  }
  if (last.speech_test === 'entera') {
    return {
      config: prev,
      message: 'Frase entera con recuperación de 30 s: repite la sesión. Más adelante decidimos la siguiente variable (una sola).',
      suggestSoft: false,
    }
  }
  return {
    config: prev,
    message: last.speech_test === 'dos' ? 'Frase partida en dos: nivel correcto, repite.' : 'Repite la misma sesión y haz el test de habla al final.',
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

/** Advertencias de tus propias reglas: un día entre intervalos y no más de 3 por semana. */
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

/** Motivos para pasar de intervalos a caminata suave (o reducir la inclinación) por la pierna. */
export function legReasons(ctx: LegContext): string[] {
  const out: string[] = []
  if (ctx.yesterday) out.push('Ayer fue día de pierna: los intervalos a 9,5-10 km/h cargan justo esos músculos.')
  if (ctx.soreness != null && ctx.soreness >= 6) out.push(`Tus agujetas de pierna están en ${ctx.soreness}/10.`)
  return out
}
