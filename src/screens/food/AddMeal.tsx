import { useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { FoodData } from '../../lib/useFoodData'
import type { Food, MealEntry, MealKey, Recipe } from '../../types'
import { MEALS, foodMacros, householdLabel, recipeMacros, roundMacros, scaleMacros } from '../../lib/nutrition'

type Mode = 'recetas' | 'alimentos' | 'rapido'
type Selected = { kind: 'recipe'; recipe: Recipe } | { kind: 'food'; food: Food } | null

interface Props {
  date: string
  data: FoodData
  recents: MealEntry[]
  defaultMeal: MealKey
  presetRecipeId: string | null
  onSaved: () => void
  onClose: () => void
}

const parse = (s: string): number => Number(s.replace(',', '.'))
const fmt = (n: number, d = 0) => n.toFixed(d).replace('.', ',')

export default function AddMeal({ date, data, recents, defaultMeal, presetRecipeId, onSaved, onClose }: Props) {
  const preset = presetRecipeId ? data.recipes.find((r) => r.id === presetRecipeId) : undefined
  const [meal, setMeal] = useState<MealKey>(defaultMeal)
  const [mode, setMode] = useState<Mode>('recetas')
  const [query, setQuery] = useState('')
  const [maxMin, setMaxMin] = useState<number | null>(null)
  const [selected, setSelected] = useState<Selected>(preset ? { kind: 'recipe', recipe: preset } : null)
  const [servings, setServings] = useState('1')
  const [amount, setAmount] = useState('')
  const [useUnit, setUseUnit] = useState(true)
  const [note, setNote] = useState('')
  const [qLabel, setQLabel] = useState('')
  const [qKcal, setQKcal] = useState('')
  const [qProtein, setQProtein] = useState('')
  const [qCarbs, setQCarbs] = useState('')
  const [qFat, setQFat] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const q = query.trim().toLowerCase()
  const recipes = useMemo(
    () =>
      data.recipes
        .filter((r) => (!q || r.name.toLowerCase().includes(q)) && (maxMin == null || r.minutes <= maxMin))
        .sort((a, b) => a.minutes - b.minutes || a.name.localeCompare(b.name)),
    [data.recipes, q, maxMin],
  )
  const foods = useMemo(() => data.foods.filter((f) => !q || f.name.toLowerCase().includes(q)), [data.foods, q])

  const recent = useMemo(() => {
    const seen = new Set<string>()
    const out: Exclude<Selected, null>[] = []
    for (const e of recents) {
      const key = e.recipe_id ?? e.food_id
      if (!key || seen.has(key)) continue
      seen.add(key)
      const recipe = e.recipe_id ? data.recipes.find((r) => r.id === e.recipe_id) : undefined
      const food = e.food_id ? data.foodById.get(e.food_id) : undefined
      if (recipe) out.push({ kind: 'recipe', recipe })
      else if (food) out.push({ kind: 'food', food })
      if (out.length >= 6) break
    }
    return out
  }, [recents, data])

  function pick(s: Exclude<Selected, null>) {
    setSelected(s)
    setErr(null)
    setServings('1')
    setNote('')
    if (s.kind === 'food') {
      setUseUnit(!!s.food.unit_g)
      setAmount(s.food.unit_g ? '1' : '100')
    }
  }

  const preview = useMemo(() => {
    if (!selected) return null
    if (selected.kind === 'recipe') {
      const n = parse(servings)
      if (!(n > 0)) return null
      const base = recipeMacros(data.itemsByRecipe.get(selected.recipe.id) ?? [], data.foodById, selected.recipe.servings)
      return { macros: roundMacros(scaleMacros(base, n)), servings: n, grams: null as number | null }
    }
    const a = parse(amount)
    if (!(a > 0)) return null
    const grams = useUnit && selected.food.unit_g ? a * selected.food.unit_g : a
    return { macros: roundMacros(foodMacros(selected.food, grams)), servings: null as number | null, grams }
  }, [selected, servings, amount, useUnit, data])

  async function save() {
    setErr(null)
    let row: Record<string, unknown>
    if (mode === 'rapido' && !selected) {
      const kcal = parse(qKcal)
      const protein = parse(qProtein || '0')
      if (!qLabel.trim()) return setErr('Escribe qué comiste.')
      if (!(kcal >= 0) || !qKcal.trim()) return setErr('Escribe las calorías.')
      if (!(protein >= 0)) return setErr('Revisa la proteína.')
      row = { date, meal, label: qLabel.trim(), kcal: Math.round(kcal), protein, carbs: parse(qCarbs || '0') || 0, fat: parse(qFat || '0') || 0, note: note.trim() || null }
    } else {
      if (!selected || !preview) return setErr('Elige un alimento o receta y una cantidad válida.')
      row = {
        date,
        meal,
        recipe_id: selected.kind === 'recipe' ? selected.recipe.id : null,
        food_id: selected.kind === 'food' ? selected.food.id : null,
        label: selected.kind === 'recipe' ? selected.recipe.name : selected.food.name,
        servings: preview.servings,
        grams: preview.grams,
        ...preview.macros,
        note: note.trim() || null,
      }
    }
    setSaving(true)
    const { error } = await supabase.from('meal_log').insert(row)
    setSaving(false)
    if (error) return setErr(error.message)
    onSaved()
  }

  const selectedFood = selected?.kind === 'food' ? selected.food : null

  return (
    <div className="overlay" role="dialog" aria-label="Añadir comida">
      <div className="overlay-inner">
        <div className="row between">
          <h2>Añadir comida</h2>
          <button onClick={onClose}>Cerrar</button>
        </div>

        <div className="chips">
          {MEALS.map((m) => (
            <button key={m.key} className={`chip ${meal === m.key ? 'on' : ''}`} onClick={() => setMeal(m.key)}>
              {m.label}
            </button>
          ))}
        </div>

        {!selected && (
          <>
            <div className="subtabs">
              {([['recetas', 'Recetas'], ['alimentos', 'Alimentos'], ['rapido', 'Rápido']] as [Mode, string][]).map(([k, label]) => (
                <button key={k} className={mode === k ? 'active' : ''} onClick={() => setMode(k)}>{label}</button>
              ))}
            </div>

            {mode !== 'rapido' && (
              <>
                <input placeholder="Buscar" value={query} onChange={(e) => setQuery(e.target.value)} />
                {!q && recent.length > 0 && (
                  <div>
                    <p className="muted">Recientes</p>
                    <div className="chips">
                      {recent.map((s) => (
                        <button key={s.kind === 'recipe' ? s.recipe.id : s.food.id} className="chip" onClick={() => pick(s)}>
                          {s.kind === 'recipe' ? s.recipe.name : s.food.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {mode === 'recetas' && (
              <>
                <div className="chips">
                  {[null, 5, 10, 15].map((m) => (
                    <button key={String(m)} className={`chip ${maxMin === m ? 'on' : ''}`} onClick={() => setMaxMin(m)}>
                      {m == null ? 'Todas' : `≤ ${m} min`}
                    </button>
                  ))}
                </div>
                {recipes.map((r) => {
                  const m = roundMacros(recipeMacros(data.itemsByRecipe.get(r.id) ?? [], data.foodById, r.servings))
                  return (
                    <button key={r.id} className="exrow" onClick={() => pick({ kind: 'recipe', recipe: r })}>
                      <span>
                        <strong>{r.name}</strong>
                        <small>{r.minutes} min · {m.kcal} kcal · {fmt(m.protein)} g proteína</small>
                      </span>
                    </button>
                  )
                })}
                {recipes.length === 0 && <p className="muted">Ninguna receta coincide.</p>}
              </>
            )}

            {mode === 'alimentos' && (
              <>
                {foods.map((f) => (
                  <button key={f.id} className="exrow" onClick={() => pick({ kind: 'food', food: f })}>
                    <span>
                      <strong>{f.name}</strong>
                      <small>por 100 g: {fmt(f.kcal)} kcal · {fmt(f.protein, 1)} g proteína</small>
                    </span>
                  </button>
                ))}
                {foods.length === 0 && <p className="muted">Ningún alimento coincide. Prueba en "Rápido" o créalo en Comida → Alimentos.</p>}
              </>
            )}

            {mode === 'rapido' && (
              <section className="card">
                <p className="muted">Para lo que no está en la lista. Calorías y proteína bastan; el resto es opcional.</p>
                <label>Qué comiste<input value={qLabel} onChange={(e) => setQLabel(e.target.value)} /></label>
                <div className="row">
                  <label style={{ flex: 1 }}>Calorías<input inputMode="numeric" value={qKcal} onChange={(e) => setQKcal(e.target.value)} /></label>
                  <label style={{ flex: 1 }}>Proteína (g)<input inputMode="decimal" value={qProtein} onChange={(e) => setQProtein(e.target.value)} /></label>
                </div>
                <div className="row">
                  <label style={{ flex: 1 }}>Carbohidratos (g)<input inputMode="decimal" placeholder="opcional" value={qCarbs} onChange={(e) => setQCarbs(e.target.value)} /></label>
                  <label style={{ flex: 1 }}>Grasa (g)<input inputMode="decimal" placeholder="opcional" value={qFat} onChange={(e) => setQFat(e.target.value)} /></label>
                </div>
                <label>Nota (opcional)<input value={note} onChange={(e) => setNote(e.target.value)} /></label>
                {err && <p className="err">{err}</p>}
                <button className="primary" disabled={saving} onClick={save}>Registrar</button>
              </section>
            )}
          </>
        )}

        {selected && (
          <section className="card">
            <div className="row between">
              <h3>{selected.kind === 'recipe' ? selected.recipe.name : selected.food.name}</h3>
              <button className="link" onClick={() => setSelected(null)}>Cambiar</button>
            </div>

            {selected.kind === 'recipe' && (
              <>
                <p className="muted">Raciones</p>
                <div className="chips">
                  {['0.5', '1', '1.5', '2'].map((s) => (
                    <button key={s} className={`chip ${servings === s ? 'on' : ''}`} onClick={() => setServings(s)}>{s.replace('.', ',')}</button>
                  ))}
                  <input style={{ width: 80 }} inputMode="decimal" value={servings} onChange={(e) => setServings(e.target.value)} aria-label="Raciones" />
                </div>
              </>
            )}

            {selectedFood && (
              <div className="row">
                <label style={{ flex: 1 }}>Cantidad<input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
                <label style={{ flex: 1 }}>Unidad
                  <select value={useUnit && selectedFood.unit_g ? 'u' : 'g'} onChange={(e) => {
                    const toUnit = e.target.value === 'u'
                    setUseUnit(toUnit)
                    setAmount(toUnit ? '1' : String(selectedFood.unit_g ?? 100))
                  }}>
                    <option value="g">gramos</option>
                    {selectedFood.unit_g && <option value="u">{selectedFood.unit_plural ?? selectedFood.unit_label}</option>}
                  </select>
                </label>
              </div>
            )}

            {selected.kind === 'recipe' && (
              <details>
                <summary>Ingredientes</summary>
                {(data.itemsByRecipe.get(selected.recipe.id) ?? []).map((it) => {
                  const f = data.foodById.get(it.food_id)
                  const house = f ? householdLabel(f, it.grams) : null
                  return <p key={it.id} className="muted">{f?.name ?? '—'}: {fmt(it.grams)} g{house ? ` (${house})` : ''}</p>
                })}
              </details>
            )}

            {preview ? (
              <p>
                <strong>{preview.macros.kcal} kcal</strong> · <strong>{fmt(preview.macros.protein, 1)} g proteína</strong>
                <span className="muted"> · {fmt(preview.macros.carbs, 1)} g carb · {fmt(preview.macros.fat, 1)} g grasa</span>
              </p>
            ) : (
              <p className="muted">Escribe una cantidad válida.</p>
            )}

            <label>Nota (opcional: cómo te sentó, molestias…)<input value={note} onChange={(e) => setNote(e.target.value)} /></label>
            {err && <p className="err">{err}</p>}
            <button className="primary" disabled={saving || !preview} onClick={save}>Registrar</button>
          </section>
        )}
      </div>
    </div>
  )
}
