import { useCallback, useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

interface Remote {
  version: string
  build: string
}

/** Borra la copia guardada (service worker y cachés) y recarga, para traer la versión nueva sí o sí. */
async function hardUpdate() {
  try {
    const regs = await navigator.serviceWorker.getRegistrations()
    await Promise.all(regs.map((r) => r.unregister()))
    for (const k of await caches.keys()) await caches.delete(k)
  } catch {
    /* sin service worker: basta con recargar */
  }
  location.reload()
}

/**
 * Cuando hay una versión nueva, la app pide actualizar antes de continuar. No se recarga sola.
 * Se detecta de dos formas: (1) al abrir la app y al volver a ella se lee /version.json (sin caché) y se compara
 * con la compilación en uso; (2) el aviso del service worker cuando termina de descargar la versión nueva.
 * Tus series ya se guardan al instante y el cardio / descanso en curso se conservan al recargar.
 */
export default function UpdateBanner() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()
  const [remote, setRemote] = useState<Remote | null>(null)

  const check = useCallback(async () => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' })
      if (!res.ok) return
      const r = (await res.json()) as Remote
      if (r.build && r.build !== __BUILD_ID__) setRemote(r)
    } catch {
      /* sin conexión: se vuelve a comprobar luego */
    }
  }, [])

  useEffect(() => {
    void check()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check()
    }
    document.addEventListener('visibilitychange', onVisible)
    const t = window.setInterval(() => void check(), 5 * 60 * 1000)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(t)
    }
  }, [check])

  if (!needRefresh && !remote) return null
  return (
    <div className="updatemodal" role="alertdialog" aria-modal="true" aria-labelledby="upd-title">
      <div className="card">
        <h3 id="upd-title">Hay una versión nueva{remote ? ` (${remote.version})` : ''}</h3>
        <p>Actualiza para seguir usando la app. Tu sesión, tus series y el cardio o descanso en curso se conservan.</p>
        <button className="primary" onClick={() => (remote ? void hardUpdate() : void updateServiceWorker(true))}>
          Actualizar ahora
        </button>
      </div>
    </div>
  )
}
