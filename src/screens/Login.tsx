import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'in' | 'up' | 'reset'>('in')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    let errorMessage: string | null = null
    let confirmationRequired = false
    if (mode === 'in') {
      errorMessage = (await supabase.auth.signInWithPassword({ email, password })).error?.message ?? null
    } else if (mode === 'up') {
      const result = await supabase.auth.signUp({ email, password })
      errorMessage = result.error?.message ?? null
      confirmationRequired = !result.data.session
    } else {
      errorMessage = (await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}` })).error?.message ?? null
    }
    setBusy(false)
    if (errorMessage) setMsg(errorMessage)
    else if (confirmationRequired) setMsg('Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.')
    else if (mode === 'reset') setMsg('Si existe una cuenta con ese correo, recibirás un enlace para cambiar la contraseña. Revisa también el correo no deseado.')
  }

  return (
    <div className="center">
      <form className="card login" onSubmit={submit}>
        <h1>Entreno</h1>
        <label>
          Correo
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        {mode !== 'reset' && <label>
          Contraseña
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} minLength={8} required />
        </label>}
        {msg && <p className="err">{msg}</p>}
        <button className="primary" disabled={busy}>{busy ? 'Un momento…' : mode === 'in' ? 'Entrar' : mode === 'up' ? 'Crear cuenta' : 'Enviar enlace de recuperación'}</button>
        {mode === 'in' && <button type="button" className="link" onClick={() => { setMsg(null); setMode('reset') }}>Olvidé mi contraseña</button>}
        {mode !== 'in' && <button type="button" className="link" onClick={() => { setMsg(null); setMode('in') }}>Volver a iniciar sesión</button>}
        {mode === 'in' && <button type="button" className="link" onClick={() => { setMsg(null); setMode('up') }}>Primera vez: crear cuenta</button>}
      </form>
    </div>
  )
}
