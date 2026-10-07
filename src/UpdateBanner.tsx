import { useRegisterSW } from 'virtual:pwa-register/react'

/** Aviso de versión nueva: la app NO se recarga sola (así no se interrumpe un cardio o una serie); actualizas tú. */
export default function UpdateBanner() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()
  if (!needRefresh) return null
  return (
    <div className="updatebar" role="status">
      <span>Hay una versión nueva. Actualiza cuando no estés en medio de una serie o del cardio.</span>
      <button onClick={() => void updateServiceWorker(true)}>Actualizar</button>
    </div>
  )
}
