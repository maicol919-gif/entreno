import { describe, expect, it } from 'vitest'
import { SEED_FOODS, SEED_RECIPES } from './foodSeed'
import { recipeMacros, roundMacros } from '../lib/nutrition'

const foods = new Map(SEED_FOODS.map((f, i) => [f.name, { ...f, food_id: String(i) }]))
const byId = new Map([...foods.values()].map((f) => [f.food_id, f]))

describe('datos iniciales de alimentación', () => {
  it('no hay alimentos ni recetas con nombre repetido', () => {
    expect(new Set(SEED_FOODS.map((f) => f.name)).size).toBe(SEED_FOODS.length)
    expect(new Set(SEED_RECIPES.map((r) => r.name)).size).toBe(SEED_RECIPES.length)
  })

  it('cada ingrediente de cada receta existe como alimento', () => {
    for (const r of SEED_RECIPES) for (const [name] of r.items) expect(foods.has(name), `${r.name}: ${name}`).toBe(true)
  })

  it('las calorías de cada alimento coinciden con sus macros (Atwater, margen 25 %)', () => {
    for (const f of SEED_FOODS) {
      const est = f.protein * 4 + f.carbs * 4 + f.fat * 9
      expect(Math.abs(est - f.kcal), f.name).toBeLessThanOrEqual(Math.max(25, f.kcal * 0.25))
    }
  })

  it('cada receta es razonable: 250-800 kcal y 20 g de proteína o más por ración', () => {
    for (const r of SEED_RECIPES) {
      const m = roundMacros(recipeMacros(r.items.map(([n, g]) => ({ food_id: foods.get(n)!.food_id, grams: g })), byId, 1))
      expect(m.kcal, r.name).toBeGreaterThanOrEqual(250)
      expect(m.kcal, r.name).toBeLessThanOrEqual(800)
      expect(m.protein, r.name).toBeGreaterThanOrEqual(20)
    }
  })
})
