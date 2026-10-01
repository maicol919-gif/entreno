import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

const KEY = 'entreno.rest.endsAt'

interface RestCtx {
  /** segundos restantes (0 = sin descanso activo) */
  remaining: number
  finished: boolean
  start: (seconds: number) => void
  add: (seconds: number) => void
  clear: () => void
}

const Ctx = createContext<RestCtx | null>(null)

export function useRest(): RestCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error('useRest fuera de RestProvider')
  return v
}

function readEnd(): number | null {
  try {
    const v = Number(localStorage.getItem(KEY))
    return v > Date.now() ? v : null
  } catch {
    return null
  }
}

function writeEnd(v: number | null) {
  try {
    if (v == null) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, String(v))
  } catch {
    /* sin almacenamiento: el contador sigue funcionando en memoria */
  }
}

function beep() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AC()
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.value = 880
      g.gain.value = 0.15
      o.connect(g)
      g.connect(ctx.destination)
      o.start(ctx.currentTime + i * 0.25)
      o.stop(ctx.currentTime + i * 0.25 + 0.15)
    }
  } catch {
    /* el navegador puede bloquear el audio: la vibración y el aviso visual bastan */
  }
}

/** El descanso se guarda como hora de fin: no se pierde al cambiar de pantalla, recargar o bloquear el celular. */
export function RestProvider({ children }: { children: ReactNode }) {
  const [endsAt, setEndsAt] = useState<number | null>(() => readEnd())
  const [now, setNow] = useState(() => Date.now())
  const [finished, setFinished] = useState(false)
  const alerted = useRef(false)

  useEffect(() => {
    if (endsAt == null) return
    const t = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(t)
  }, [endsAt])

  const remaining = endsAt == null ? 0 : Math.max(0, Math.ceil((endsAt - now) / 1000))

  useEffect(() => {
    if (endsAt != null && remaining === 0 && !alerted.current) {
      alerted.current = true
      navigator.vibrate?.([300, 150, 300, 150, 300])
      beep()
      setFinished(true)
      writeEnd(null)
      const t = window.setTimeout(() => {
        setFinished(false)
        setEndsAt(null)
      }, 8000)
      return () => window.clearTimeout(t)
    }
  }, [endsAt, remaining])

  const start = useCallback((seconds: number) => {
    const end = Date.now() + seconds * 1000
    alerted.current = false
    setFinished(false)
    setNow(Date.now())
    setEndsAt(end)
    writeEnd(end)
  }, [])

  const add = useCallback((seconds: number) => {
    setEndsAt((cur) => {
      if (cur == null) return cur
      const next = Math.max(Date.now() + 1000, cur + seconds * 1000)
      writeEnd(next)
      return next
    })
  }, [])

  const clear = useCallback(() => {
    alerted.current = true
    setFinished(false)
    setEndsAt(null)
    writeEnd(null)
  }, [])

  return <Ctx.Provider value={{ remaining, finished, start, add, clear }}>{children}</Ctx.Provider>
}

export function RestBar() {
  const { remaining, finished, add, clear } = useRest()
  if (remaining === 0 && !finished) return null
  const mm = Math.floor(remaining / 60)
  const ss = String(remaining % 60).padStart(2, '0')
  return (
    <div className={`restbar ${finished ? 'done' : ''}`} role="timer" aria-live="off">
      {finished ? (
        <>
          <strong>¡Descanso terminado! Siguiente serie</strong>
          <button onClick={clear}>OK</button>
        </>
      ) : (
        <>
          <button onClick={() => add(-30)} aria-label="Restar 30 segundos">−30</button>
          <strong className="clock">{mm}:{ss}</strong>
          <button onClick={() => add(30)} aria-label="Sumar 30 segundos">+30</button>
          <button className="skip" onClick={clear}>Saltar</button>
        </>
      )}
    </div>
  )
}
