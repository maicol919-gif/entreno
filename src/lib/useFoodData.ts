import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { seedFoodIfEmpty } from './foodSeed'
import type { Food, Recipe, RecipeItem } from '../types'

const num = (v: unknown): number => Number(v)

export interface FoodData {
  foods: Food[]
  recipes: Recipe[]
  items: RecipeItem[]
  foodById: Map<string, Food>
  itemsByRecipe: Map<string, RecipeItem[]>
  reload: () => Promise<void>
}

/** Alimentos, recetas e ingredientes del usuario; la primera vez carga los iniciales. */
export function useFoodData(): { data: FoodData | null; error: string | null } {
  const [raw, setRaw] = useState<{ foods: Food[]; recipes: Recipe[]; items: RecipeItem[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      await seedFoodIfEmpty()
      const [f, r, i] = await Promise.all([
        supabase.from('foods').select('*').order('name'),
        supabase.from('recipes').select('*').order('name'),
        supabase.from('recipe_items').select('*').order('position'),
      ])
      for (const res of [f, r, i]) if (res.error) throw res.error
      setRaw({
        foods: (f.data ?? []).map((x) => ({ ...x, kcal: num(x.kcal), protein: num(x.protein), carbs: num(x.carbs), fat: num(x.fat), unit_g: x.unit_g == null ? null : num(x.unit_g) })) as Food[],
        recipes: (r.data ?? []).map((x) => ({ ...x, servings: num(x.servings) })) as Recipe[],
        items: (i.data ?? []).map((x) => ({ ...x, grams: num(x.grams) })) as RecipeItem[],
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String((e as { message?: string }).message ?? e))
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const data = useMemo<FoodData | null>(() => {
    if (!raw) return null
    const itemsByRecipe = new Map<string, RecipeItem[]>()
    for (const it of raw.items) itemsByRecipe.set(it.recipe_id, [...(itemsByRecipe.get(it.recipe_id) ?? []), it])
    return { ...raw, foodById: new Map(raw.foods.map((x) => [x.id, x])), itemsByRecipe, reload }
  }, [raw, reload])

  return { data, error }
}
