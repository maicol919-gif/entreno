import { supabase } from '../lib/supabase'
import { useData } from '../store'
import GymPhotos from './GymPhotos'

export default function Gym() {
  const { exercises, reload } = useData()

  async function restore(id: string) {
    await supabase.from('exercises').update({ available: true }).eq('id', id)
    await reload()
  }

  const missing = exercises.filter((e) => !e.available)
  const byEquip = new Map<string, typeof exercises>()
  for (const e of exercises.filter((x) => x.available)) byEquip.set(e.equipment ?? 'Otros', [...(byEquip.get(e.equipment ?? 'Otros') ?? []), e])

  return (
    <div className="screen">
      <h2>Mi gimnasio (Darko)</h2>
      <GymPhotos />
      <p className="muted">
        No tienes que marcar nada: se asume que hay todo. Si en un ejercicio no encuentras la máquina, toca "No hay esta máquina" dentro del ejercicio y la app te propone un reemplazo.
      </p>
      {missing.length > 0 && (
        <section className="card warn">
          <h3>Máquinas que no hay</h3>
          {missing.map((e) => (
            <div key={e.id} className="row between">
              <span>{e.name}</span>
              <button className="link" onClick={() => void restore(e.id)}>Ya la hay</button>
            </div>
          ))}
        </section>
      )}
      {[...byEquip.entries()].map(([equip, list]) => (
        <section key={equip} className="card">
          <h3>{equip}</h3>
          {list.map((e) => <p key={e.id} className="muted">{e.name}</p>)}
        </section>
      ))}
    </div>
  )
}
