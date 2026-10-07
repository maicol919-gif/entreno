import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface Photo {
  id: string
  path: string
  note: string | null
  tags: string[]
  created_at: string
  url?: string
}

const BUCKET = 'gym-photos'

/** Reduce la foto (máx. 1600 px, JPEG) para ahorrar datos y espacio. */
async function shrink(file: File, max = 1600): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo procesar la imagen'))), 'image/jpeg', 0.82),
  )
}

export default function GymPhotos() {
  const [photos, setPhotos] = useState<Photo[] | null>(null)
  const [note, setNote] = useState('')
  const [tags, setTags] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('gym_photos').select('*').order('created_at', { ascending: false })
    if (error) {
      setMsg(error.message)
      setPhotos([])
      return
    }
    const rows = (data ?? []) as Photo[]
    if (rows.length) {
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(rows.map((r) => r.path), 3600)
      const byPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]))
      for (const r of rows) r.url = byPath.get(r.path) ?? undefined
    }
    setPhotos(rows)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])]
    e.target.value = ''
    if (files.length === 0) return
    setBusy(true)
    setMsg(null)
    try {
      const { data: u } = await supabase.auth.getUser()
      const uid = u.user?.id
      if (!uid) throw new Error('Sesión no válida: vuelve a iniciar sesión.')
      const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean)
      let ok = 0
      for (const [i, f] of files.entries()) {
        const blob = await shrink(f)
        const path = `${uid}/${Date.now()}-${i}.jpg`
        const up = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' })
        if (up.error) throw up.error
        const ins = await supabase.from('gym_photos').insert({ path, note: note || null, tags: tagList })
        if (ins.error) throw ins.error
        ok += 1
      }
      setMsg(`${ok} foto${ok === 1 ? '' : 's'} subida${ok === 1 ? '' : 's'}.`)
      setNote('')
      setTags('')
      await load()
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function remove(p: Photo) {
    if (!window.confirm('¿Borrar esta foto?')) return
    await supabase.storage.from(BUCKET).remove([p.path])
    await supabase.from('gym_photos').delete().eq('id', p.id)
    await load()
  }

  async function copyLink(p: Photo) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(p.path, 7 * 86400)
    if (error || !data) {
      setMsg(error?.message ?? 'No se pudo crear el enlace.')
      return
    }
    try {
      await navigator.clipboard.writeText(data.signedUrl)
      setMsg('Enlace copiado (válido 7 días).')
    } catch {
      window.prompt('Copia este enlace (válido 7 días):', data.signedUrl)
    }
  }

  return (
    <section className="card">
      <h3>Fotos del gimnasio</h3>
      <p className="muted">
        Sube fotos de las máquinas nuevas y cuéntame qué se ve. Son privadas: solo las ves tú. Con ellas se actualiza el catálogo y la rutina.
      </p>
      <label>Nota (opcional)
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej.: zona de piernas, máquinas nuevas" />
      </label>
      <label>Máquinas que reconoces (opcional, separadas por coma)
        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Ej.: prensa 45°, hack squat" />
      </label>
      <label className="filebtn">
        {busy ? 'Subiendo…' : '📷 Subir fotos'}
        <input type="file" accept="image/*" multiple disabled={busy} onChange={onFiles} hidden />
      </label>
      {msg && <p className="muted">{msg}</p>}

      {photos === null && <p className="muted">Cargando…</p>}
      <div className="photogrid">
        {(photos ?? []).map((p) => (
          <figure key={p.id}>
            {p.url ? <img src={p.url} alt={p.note ?? 'Foto del gimnasio'} loading="lazy" /> : <div className="noimg">Sin vista previa</div>}
            <figcaption>
              <small>{new Date(p.created_at).toLocaleDateString('es-ES')}{p.note ? ` · ${p.note}` : ''}</small>
              {p.tags.length > 0 && <small className="muted">{p.tags.join(', ')}</small>}
              <span className="row">
                <button className="link" onClick={() => copyLink(p)}>Copiar enlace</button>
                <button className="link" onClick={() => remove(p)}>Borrar</button>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}
