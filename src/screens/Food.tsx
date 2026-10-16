import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../store'
import { toISODate } from '../lib/plan'
import { useFoodData } from '../lib/useFoodData'
import { MEAL_BUCKET, signedPhotoUrls } from '../lib/photo'
import { itemsSummary } from '../lib/meal'
import { MEALS, kcalState, mealForHour, proteinState, remaining, sumMacros } from '../lib/nutrition'
import type { MealEntry } from '../types'
import AddMeal from './food/AddMeal'
import Recipes from './food/Recipes'
import Foods from './food/Foods'

type View = 'hoy' | 'recetas' | 'alimentos'

const fmt = (n: number, d = 0) => n.toFixed(d).replace('.', ',')

function shiftDate(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

function dateLabel(date: string): string {
  const today = toISODate(new Date())
  if (date === today) return 'Hoy'
  if (date === shiftDate(today, -1)) return 'Ayer'
  const [, m, d] = date.split('-')
  return `${d}/${m}`
}

function Bar({ label, eaten, target, state, unit }: { label: string; eaten: number; target: number; state: 'bajo' | 'ok' | 'pasado'; unit: string }) {
  const pct = Math.min(100, target > 0 ? (eaten / target) * 100 : 0)
  return (
    <div className="bigbar">
      <div className="row between">
        <strong>{label}</strong>
        <span className={state === 'ok' ? 'ok' : state === 'pasado' ? 'warn-text' : ''}>
          {fmt(eaten)} / {fmt(target)} {unit}
        </span>
      </div>
      <div className="progress"><div className={state} style={{ width: `${pct}%` }} /></div>
    </div>
  )
}

export default function Food() {
  const { settings } = useData()
  const { data, error } = useFoodData()
  const [view, setView] = useState<View>('hoy')
  const [date, setDate] = useState(() => toISODate(new Date()))
  const [entries, setEntries] = useState<MealEntry[]>([])
  const [recents, setRecents] = useState<MealEntry[]>([])
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})
  const [adding, setAdding] = useState<{ recipeId: string | null; entry: MealEntry | null } | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const loadEntries = useCallback(async () => {
    const { data: rows, error: e } = await supabase.from('meal_log').select('*').eq('date', date).order('created_at')
    if (e) return setMsg(e.message)
    const list = (rows ?? []).map((r) => ({
      ...r,
      servings: r.servings == null ? null : Number(r.servings),
      grams: r.grams == null ? null : Number(r.grams),
      kcal: Number(r.kcal),
      protein: Number(r.protein),
      carbs: Number(r.carbs),
      fat: Number(r.fat),
    })) as MealEntry[]
    setEntries(list)
    const paths = list.map((x) => x.photo_path).filter((p): p is string => !!p)
    setPhotoUrls(await signedPhotoUrls(paths))
  }, [date])

  const loadRecents = useCallback(async () => {
    const { data: rows } = await supabase.from('meal_log').select('*').order('created_at', { ascending: false }).limit(60)
    setRecents(((rows ?? []) as MealEntry[]).map((r) => ({ ...r, kcal: Number(r.kcal), protein: Number(r.protein) })))
  }, [])

  useEffect(() => {
    void loadEntries()
  }, [loadEntries])
  useEffect(() => {
    void loadRecents()
  }, [loadRecents])

  const done = useMemo(() => entries.filter((e) => e.status !== 'pending'), [entries])
  const pending = useMemo(() => entries.filter((e) => e.status === 'pending'), [entries])
  const total = useMemo(() => sumMacros(done), [done])
  const target = { kcal: settings.kcal_target, protein: settings.protein_target }
  const left = remaining(target, total)

  async function removeEntry(e: MealEntry) {
    const { error: err } = await supabase.from('meal_log').delete().eq('id', e.id)
    if (err) return setMsg(err.message)
    if (e.photo_path) await supabase.storage.from(MEAL_BUCKET).remove([e.photo_path])
    await Promise.all([loadEntries(), loadRecents()])
  }

  async function onSaved() {
    setAdding(null)
    setMsg(null)
    await Promise.all([loadEntries(), loadRecents()])
  }

  if (error) return <div className="screen"><p className="err">No se pudo cargar la alimentación: {error}</p></div>
  if (!data) return <div className="screen"><p>Cargando…</p></div>

  const isToday = date === toISODate(new Date())

  return (
    <div className="screen">
      <h2>Comida</h2>
      <div className="subtabs">
        {([['hoy', 'Mi día'], ['recetas', 'Recetas'], ['alimentos', 'Alimentos']] as [View, string][]).map(([k, label]) => (
          <button key={k} className={view === k ? 'active' : ''} onClick={() => setView(k)}>{label}</button>
        ))}
      </div>
      {msg && <p className="err">{msg}</p>}

      {view === 'hoy' && (
        <>
          <div className="row between">
            <button onClick={() => setDate(shiftDate(date, -1))} aria-label="Día anterior">←</button>
            <strong>{dateLabel(date)}</strong>
            <button onClick={() => setDate(shiftDate(date, 1))} disabled={isToday} aria-label="Día siguiente">→</button>
          </div>

          <section className="card">
            <Bar label="Proteína" eaten={total.protein} target={target.protein} state={proteinState(total.protein, target.protein)} unit="g" />
            <Bar label="Calorías" eaten={total.kcal} target={target.kcal} state={kcalState(total.kcal, target.kcal)} unit="kcal" />
            <p className="muted">
              {left.protein > 0 ? `Te faltan ${fmt(left.protein)} g de proteína` : 'Meta de proteína cumplida'}
              {left.kcal > 0 ? ` y te quedan ${fmt(left.kcal)} kcal.` : total.kcal > target.kcal * 1.05 ? ` · ${fmt(total.kcal - target.kcal)} kcal por encima de la meta.` : '.'}
            </p>
            <p className="muted">Carbohidratos {fmt(total.carbs)} g · Grasa {fmt(total.fat)} g</p>
          </section>

          <button className="primary" onClick={() => setAdding({ recipeId: null, entry: null })}>Añadir comida</button>

          {pending.length > 0 && (
            <section className="card warn">
              <h3>Por completar ({pending.length})</h3>
              <p className="muted">Todavía no cuentan en tus totales. Completa qué llevaban.</p>
              {pending.map((e) => (
                <div key={e.id} className="entry">
                  {e.photo_path && photoUrls[e.photo_path] ? <img className="thumb" src={photoUrls[e.photo_path]} alt="Foto de la comida" /> : <div className="thumb empty">sin foto</div>}
                  <div>
                    <strong>{MEALS.find((m) => m.key === e.meal)?.label}</strong>
                    <button onClick={() => setAdding({ recipeId: null, entry: e })}>Completar</button>
                  </div>
                  <button className="link" onClick={() => removeEntry(e)} aria-label="Quitar">✕</button>
                </div>
              ))}
            </section>
          )}

          {MEALS.map((m) => {
            const list = done.filter((e) => e.meal === m.key)
            if (list.length === 0) return null
            const sub = sumMacros(list)
            return (
              <section key={m.key} className="card">
                <div className="row between">
                  <h3>{m.label}</h3>
                  <span className="muted">{fmt(sub.kcal)} kcal · {fmt(sub.protein)} g prot.</span>
                </div>
                {list.map((e) => {
                  const canEdit = !!(e.items?.length || e.recipe_id || e.food_id)
                  const summary = itemsSummary(e.items)
                  return (
                    <div key={e.id} className="entry">
                      {e.photo_path && photoUrls[e.photo_path] && <img className="thumb" src={photoUrls[e.photo_path]} alt="Foto de la comida" />}
                      <div>
                        <strong>{e.label}</strong>
                        <small className="muted">{fmt(e.kcal)} kcal · {fmt(e.protein, 1)} g prot.</small>
                        {summary && <small className="muted">{summary}</small>}
                        {e.note && <small className="note">{e.note}</small>}
                        {canEdit && <button className="link" onClick={() => setAdding({ recipeId: null, entry: e })}>Editar</button>}
                      </div>
                      <button className="link" onClick={() => removeEntry(e)} aria-label={`Quitar ${e.label}`}>✕</button>
                    </div>
                  )
                })}
              </section>
            )
          })}
          {entries.length === 0 && <p className="muted">Aún no registras nada {isToday ? 'hoy' : 'este día'}.</p>}
        </>
      )}

      {view === 'recetas' && <Recipes data={data} onLog={(id) => { setView('hoy'); setAdding({ recipeId: id, entry: null }) }} />}

      {view === 'alimentos' && <Foods data={data} />}

      {adding && (
        <AddMeal
          date={date}
          data={data}
          recents={recents}
          defaultMeal={mealForHour(new Date().getHours())}
          presetRecipeId={adding.recipeId}
          editEntry={adding.entry}
          onSaved={onSaved}
          onClose={() => setAdding(null)}
        />
      )}
    </div>
  )
}
