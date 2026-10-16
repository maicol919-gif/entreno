import type { Food } from '../types'
import { foodMacros, sumMacros, type Macros } from './nutrition'

/** Una línea editable de una comida: un alimento con su cantidad, en gramos o en medida casera. */
export interface MealRow {
  key: string
  food_id: string
  amount: string
  unit: 'g' | 'u'
}

/** Ingrediente tal como se guarda en el registro. */
export interface StoredItem {
  food_id: string
  name: string
  grams: number
}

type UnitInfo = Pick<Food, 'unit_g'>

export function parseAmount(s: string): number {
  return Number(s.replace(',', '.'))
}

/** Gramos de una línea (0 si la cantidad no es válida). */
export function rowGrams(row: Pick<MealRow, 'amount' | 'unit'>, food: UnitInfo | undefined): number {
  const n = parseAmount(row.amount)
  if (!(n > 0)) return 0
  return row.unit === 'u' && food?.unit_g ? n * food.unit_g : n
}

/** Convierte gramos a la medida casera si encajan en medios (3 huevos, 7,5 cucharadas); si no, en gramos. */
export function rowFromGrams(food: Food, grams: number, key: string): MealRow {
  if (food.unit_g) {
    const units = grams / food.unit_g
    const half = Math.round(units * 2) / 2
    if (half >= 0.5 && Math.abs(units - half) < 0.03) return { key, food_id: food.id, amount: String(half).replace('.', ','), unit: 'u' }
  }
  return { key, food_id: food.id, amount: String(Math.round(grams * 10) / 10).replace('.', ','), unit: 'g' }
}

/** Líneas para unos ingredientes multiplicados por k (raciones). Ignora alimentos que ya no existen. */
export function rowsFromItems(items: { food_id: string; grams: number }[], foods: Map<string, Food>, k = 1): MealRow[] {
  return items.flatMap((it, i) => {
    const f = foods.get(it.food_id)
    return f ? [rowFromGrams(f, it.grams * k, `${it.food_id}-${i}-${k}`)] : []
  })
}

export function rowsMacros(rows: MealRow[], foods: Map<string, Food>): Macros {
  return sumMacros(
    rows.flatMap((r) => {
      const f = foods.get(r.food_id)
      const g = rowGrams(r, f)
      return f && g > 0 ? [foodMacros(f, g)] : []
    }),
  )
}

/** Ingredientes para guardar: solo líneas válidas, gramos con un decimal. */
export function toStoredItems(rows: MealRow[], foods: Map<string, Food>): StoredItem[] {
  return rows.flatMap((r) => {
    const f = foods.get(r.food_id)
    const g = rowGrams(r, f)
    return f && g > 0 ? [{ food_id: f.id, name: f.name, grams: Math.round(g * 10) / 10 }] : []
  })
}

/** Resumen corto de ingredientes para la lista del día: "Huevo entero, Atún…, +2". */
export function itemsSummary(items: StoredItem[] | null | undefined, max = 3): string {
  if (!items || items.length === 0) return ''
  const names = items.slice(0, max).map((i) => i.name.replace(/\s*\(.*\)\s*$/, ''))
  return names.join(', ') + (items.length > max ? `, +${items.length - max}` : '')
}
