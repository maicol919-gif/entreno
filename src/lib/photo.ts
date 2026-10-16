import { supabase } from './supabase'

export const MEAL_BUCKET = 'meal-photos'

/** Reduce la foto (máx. 1280 px, JPEG) para ahorrar datos y espacio. */
export async function shrinkImage(file: File, max = 1280): Promise<Blob> {
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

/** Sube la foto de una comida a tu carpeta privada y devuelve su ruta. */
export async function uploadMealPhoto(file: File): Promise<string> {
  const { data: u } = await supabase.auth.getUser()
  const uid = u.user?.id
  if (!uid) throw new Error('Sesión no válida: vuelve a iniciar sesión.')
  const blob = await shrinkImage(file)
  const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`
  const up = await supabase.storage.from(MEAL_BUCKET).upload(path, blob, { contentType: 'image/jpeg' })
  if (up.error) throw up.error
  return path
}

/** Enlaces temporales (1 hora) para mostrar las fotos privadas. */
export async function signedPhotoUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {}
  const { data } = await supabase.storage.from(MEAL_BUCKET).createSignedUrls(paths, 3600)
  const out: Record<string, string> = {}
  for (const s of data ?? []) if (s.signedUrl && s.path) out[s.path] = s.signedUrl
  return out
}
