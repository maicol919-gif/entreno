import { useEffect } from 'react'

interface Sentinel {
  release: () => Promise<void>
}
interface WakeNav {
  wakeLock?: { request: (type: 'screen') => Promise<Sentinel> }
}

/** Mantiene la pantalla encendida mientras `active` sea true (p. ej. durante toda la sesión de entreno). */
export function useKeepAwake(active: boolean) {
  useEffect(() => {
    if (!active) return
    let lock: Sentinel | null = null
    let cancelled = false
    const nav = navigator as unknown as WakeNav
    const acquire = async () => {
      try {
        const l = (await nav.wakeLock?.request('screen')) ?? null
        if (cancelled) void l?.release()
        else lock = l
      } catch {
        /* el navegador puede negarlo (ahorro de batería): se reintenta al volver a la app */
      }
    }
    // el bloqueo se libera solo al ocultar la app; se vuelve a pedir al regresar
    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire()
    }
    void acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void lock?.release()
    }
  }, [active])
}
