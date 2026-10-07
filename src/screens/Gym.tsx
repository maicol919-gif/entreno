import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../store'
import GymPhotos from './GymPhotos'

export default function Gym() {
  const { exercises, reload } = useData()
  const [local, setLocal] = useState<Record<string, boolean>>({})

  async function toggle(id: string, value: boolean) {
    setLocal((l) => ({ ...l, [id]: value }))
    await supabase.from('exercises').update({ available: value }).eq('id', id)
    await reload()
  }

  const byEquip = new Map<string, typeof exercises>()
  for (const e of exercises) byEquip.set(e.equipment ?? 'Otros', [...(byEquip.get(e.equipment ?? 'Otros') ?? []), e])

  return (
    <div className="screen">
      <h2>Mi gimnasio (Darko)</h2>
      <GymPhotos />
      <p className="muted">Marca lo que SÍ hay. Lo que desmarques aparece como "no disponible" en tu rutina.</p>
      {[...byEquip.entries()].map(([equip, list]) => (
        <section key={equip} className="card">
          <h3>{equip}</h3>
          {list.map((e) => (
            <label key={e.id} className="check-row">
              <input type="checkbox" checked={local[e.id] ?? e.available} onChange={(ev) => toggle(e.id, ev.target.checked)} />
              <span>{e.name}</span>
            </label>
          ))}
        </section>
      ))}
    </div>
  )
}
