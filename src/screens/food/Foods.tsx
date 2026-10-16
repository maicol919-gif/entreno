import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { FoodData } from '../../lib/useFoodData'
import type { Food } from '../../types'

const parse = (s: string): number => Number(s.replace(',', '.'))
const fmt = (n: number, d = 0) => n.toFixed(d).replace('.', ',')

interface Form {
  id: string | null
  name: string
  kcal: string
  protein: string
  carbs: string
  fat: string
  unit_g: string
  unit_label: string
  unit_plural: string
}

const EMPTY: Form = { id: null, name: '', kcal: '', protein: '', carbs: '', fat: '', unit_g: '', unit_label: '', unit_plural: '' }

function toForm(f: Food): Form {
  return {
    id: f.id,
    name: f.name,
    kcal: String(f.kcal),
    protein: String(f.protein),
    carbs: String(f.carbs),
    fat: String(f.fat),
    unit_g: f.unit_g == null ? '' : String(f.unit_g),
    unit_label: f.unit_label ?? '',
    unit_plural: f.unit_plural ?? '',
  }
}

export default function Foods({ data }: { data: FoodData }) {
  const [query, setQuery] = useState('')
  const [form, setForm] = useState<Form | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const q = query.trim().toLowerCase()
  const list = data.foods.filter((f) => !q || f.name.toLowerCase().includes(q))

  async function save() {
    if (!form) return
    const kcal = parse(form.kcal)
    const protein = parse(form.protein || '0')
    const carbs = parse(form.carbs || '0')
    const fat = parse(form.fat || '0')
    const unitG = form.unit_g.trim() ? parse(form.unit_g) : null
    if (!form.name.trim()) return setMsg('Escribe el nombre.')
    if (!form.kcal.trim() || ![kcal, protein, carbs, fat].every((n) => n >= 0)) return setMsg('Revisa los valores por 100 g.')
    if (unitG != null && !(unitG > 0)) return setMsg('Los gramos de la medida deben ser mayores que cero.')
    if (unitG != null && !form.unit_label.trim()) return setMsg('Escribe el nombre de la medida (ej. cucharada).')
    const row = {
      name: form.name.trim(),
      kcal,
      protein,
      carbs,
      fat,
      unit_g: unitG,
      unit_label: unitG != null ? form.unit_label.trim() : null,
      unit_plural: unitG != null ? form.unit_plural.trim() || form.unit_label.trim() : null,
    }
    const { error } = form.id ? await supabase.from('foods').update(row).eq('id', form.id) : await supabase.from('foods').insert(row)
    if (error) return setMsg(error.code === '23505' ? 'Ya existe un alimento con ese nombre.' : error.message)
    setMsg('Guardado. Las comidas ya registradas no cambian.')
    setForm(null)
    await data.reload()
  }

  async function remove() {
    if (!form?.id) return
    const { error } = await supabase.from('foods').delete().eq('id', form.id)
    if (error) return setMsg(error.code === '23503' ? 'No se puede borrar: lo usa alguna receta.' : error.message)
    setMsg('Alimento borrado.')
    setForm(null)
    await data.reload()
  }

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => (f ? { ...f, [k]: e.target.value } : f))

  if (form) {
    return (
      <section className="card">
        <h3>{form.id ? 'Editar alimento' : 'Nuevo alimento'}</h3>
        <p className="muted">Valores por 100 g, tal como salen en la etiqueta.</p>
        {msg && <p className="err">{msg}</p>}
        <label>Nombre<input value={form.name} onChange={set('name')} /></label>
        <div className="row">
          <label style={{ flex: 1 }}>Calorías<input inputMode="decimal" value={form.kcal} onChange={set('kcal')} /></label>
          <label style={{ flex: 1 }}>Proteína (g)<input inputMode="decimal" value={form.protein} onChange={set('protein')} /></label>
        </div>
        <div className="row">
          <label style={{ flex: 1 }}>Carbohidratos (g)<input inputMode="decimal" value={form.carbs} onChange={set('carbs')} /></label>
          <label style={{ flex: 1 }}>Grasa (g)<input inputMode="decimal" value={form.fat} onChange={set('fat')} /></label>
        </div>
        <h3>Medida casera (opcional)</h3>
        <div className="row">
          <label style={{ flex: 1 }}>Gramos de 1<input inputMode="decimal" placeholder="ej. 15" value={form.unit_g} onChange={set('unit_g')} /></label>
          <label style={{ flex: 1 }}>Nombre<input placeholder="cucharada" value={form.unit_label} onChange={set('unit_label')} /></label>
          <label style={{ flex: 1 }}>Plural<input placeholder="cucharadas" value={form.unit_plural} onChange={set('unit_plural')} /></label>
        </div>
        <button className="primary" onClick={save}>Guardar</button>
        <div className="row between">
          <button className="link" onClick={() => { setForm(null); setMsg(null) }}>Cancelar</button>
          {form.id && <button className="link" onClick={remove}>Borrar</button>}
        </div>
      </section>
    )
  }

  return (
    <div>
      {msg && <p className={msg.startsWith('No') || msg.startsWith('Ya') ? 'err' : 'ok'}>{msg}</p>}
      <div className="row">
        <input placeholder="Buscar alimento" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button onClick={() => { setMsg(null); setForm({ ...EMPTY }) }}>Nuevo</button>
      </div>
      <p className="muted">Toca un alimento para corregir sus valores con la etiqueta de tu marca.</p>
      {list.map((f) => (
        <button key={f.id} className="exrow" onClick={() => { setMsg(null); setForm(toForm(f)) }}>
          <span>
            <strong>{f.name}</strong>
            <small>por 100 g: {fmt(f.kcal)} kcal · {fmt(f.protein, 1)} P · {fmt(f.carbs, 1)} C · {fmt(f.fat, 1)} G{f.unit_g ? ` · 1 ${f.unit_label} = ${fmt(f.unit_g)} g` : ''}</small>
          </span>
        </button>
      ))}
    </div>
  )
}
