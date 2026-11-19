import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function PasswordRecovery({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) return setMessage('La contraseña debe tener al menos 8 caracteres.')
    if (password !== repeat) return setMessage('Las contraseñas no coinciden.')
    setBusy(true)
    setMessage(null)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) setMessage(`No se pudo cambiar la contraseña: ${error.message}`)
    else onDone()
  }

  return (
    <div className="center">
      <form className="card login" onSubmit={save}>
        <h1>Nueva contraseña</h1>
        <p className="muted">Elige una contraseña de al menos 8 caracteres para tu cuenta existente.</p>
        <label>Nueva contraseña<input type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        <label>Repite la contraseña<input type="password" autoComplete="new-password" minLength={8} value={repeat} onChange={(e) => setRepeat(e.target.value)} required /></label>
        {message && <p className="err" role="alert">{message}</p>}
        <button className="primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar contraseña'}</button>
      </form>
    </div>
  )
}
