import { useRegisterSW } from 'virtual:pwa-register/react'

/**
 * Cuando hay una versión nueva, la app pide actualizar antes de continuar.
 * No se recarga sola: lo haces tú con el botón. Tus series ya se guardan al instante y el cardio / descanso
 * en curso se conservan al recargar.
 */
export default function UpdateBanner() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()
  if (!needRefresh) return null
  return (
    <div className="updatemodal" role="alertdialog" aria-modal="true" aria-labelledby="upd-title">
      <div className="card">
        <h3 id="upd-title">Hay una versión nueva</h3>
        <p>Actualiza para seguir usando la app. Tu sesión, tus series y el cardio o descanso en curso se conservan.</p>
        <button className="primary" onClick={() => void updateServiceWorker(true)}>Actualizar ahora</button>
      </div>
    </div>
  )
}
