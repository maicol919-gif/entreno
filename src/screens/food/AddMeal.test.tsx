import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { SEED_FOODS, SEED_RECIPES } from '../../data/foodSeed'
import type { FoodData } from '../../lib/useFoodData'
import type { Food, MealEntry, Recipe, RecipeItem } from '../../types'

vi.mock('../../lib/supabase', () => ({ supabase: {} }))

const { default: AddMeal } = await import('./AddMeal')

const foods: Food[] = SEED_FOODS.map((f, i) => ({ id: `f${i}`, name: f.name, kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat, unit_g: f.unit_g ?? null, unit_label: f.unit_label ?? null, unit_plural: f.unit_plural ?? null }))
const byName = new Map(foods.map((f) => [f.name, f]))
const recipes: Recipe[] = SEED_RECIPES.map((r, i) => ({ id: `r${i}`, name: r.name, minutes: r.minutes, meal: r.meal, steps: r.steps.join('\n'), tags: r.tags, servings: 1 }))
const items: RecipeItem[] = SEED_RECIPES.flatMap((r, i) => r.items.map(([n, g], j) => ({ id: `i${i}-${j}`, recipe_id: `r${i}`, food_id: byName.get(n)!.id, grams: g, position: j })))
const itemsByRecipe = new Map<string, RecipeItem[]>()
for (const it of items) itemsByRecipe.set(it.recipe_id, [...(itemsByRecipe.get(it.recipe_id) ?? []), it])
const data: FoodData = { foods, recipes, items, foodById: new Map(foods.map((f) => [f.id, f])), itemsByRecipe, reload: async () => {} }

const base = { date: '2026-10-16', data, recents: [] as MealEntry[], defaultMeal: 'cena' as const, onSaved: () => {}, onClose: () => {} }

describe('AddMeal (render)', () => {
  it('lista de recetas al abrir', () => {
    const html = renderToString(<AddMeal {...base} presetRecipeId={null} editEntry={null} />)
    expect(html).toContain('Foto ahora, detalles después')
    expect(html).toContain('Pastel de coco proteico')
  })

  it('receta elegida: ingredientes editables con medida casera y totales', () => {
    const idx = SEED_RECIPES.findIndex((r) => r.name === 'Huevos duros con atún y arroz')
    const html = renderToString(<AddMeal {...base} presetRecipeId={`r${idx}`} editEntry={null} />)
    expect(html).toContain('Huevo entero')
    expect(html).toContain('value="3"')
    expect(html).toContain('Guardar como mi receta')
    expect(html).toContain('<strong>409<!-- --> kcal</strong>')
    expect(html).toContain('36,7')
  })

  it('completar una comida pendiente abre sin ingredientes', () => {
    const entry = { id: 'e1', date: '2026-10-16', meal: 'cena', recipe_id: null, food_id: null, label: 'Comida sin completar', servings: null, grams: null, kcal: 0, protein: 0, carbs: 0, fat: 0, note: null, items: null, photo_path: 'x.jpg', status: 'pending', created_at: '' } as MealEntry
    const html = renderToString(<AddMeal {...base} presetRecipeId={null} editEntry={entry} />)
    expect(html).toContain('Completar comida')
    expect(html).toContain('Aún no hay ingredientes')
  })

  it('editar una comida con ingredientes guardados los carga con sus cantidades', () => {
    const huevo = byName.get('Huevo entero')!
    const entry = { id: 'e2', date: '2026-10-16', meal: 'comida', recipe_id: null, food_id: null, label: 'Mi tortilla', servings: null, grams: null, kcal: 236, protein: 20.8, carbs: 1, fat: 15.7, note: null, items: [{ food_id: huevo.id, name: huevo.name, grams: 110 }], photo_path: null, status: 'done', created_at: '' } as MealEntry
    const html = renderToString(<AddMeal {...base} presetRecipeId={null} editEntry={entry} />)
    expect(html).toContain('Mi tortilla')
    expect(html).toContain('value="2"')
    expect(html).toContain('Guardar cambios')
  })
})
