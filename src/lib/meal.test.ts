import { describe, expect, it } from 'vitest'
import { itemsSummary, parseAmount, rowFromGrams, rowGrams, rowsFromItems, rowsMacros, toStoredItems, type MealRow } from './meal'
import type { Food } from '../types'

const huevo: Food = { id: 'h', name: 'Huevo entero', kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5, unit_g: 55, unit_label: 'huevo', unit_plural: 'huevos' }
const arroz: Food = { id: 'a', name: 'Arroz cocido', kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, unit_g: 20, unit_label: 'cucharada', unit_plural: 'cucharadas' }
const aceite: Food = { id: 'o', name: 'Aceite de oliva', kcal: 884, protein: 0, carbs: 0, fat: 100, unit_g: null, unit_label: null, unit_plural: null }
const foods = new Map([huevo, arroz, aceite].map((f) => [f.id, f]))

const row = (food_id: string, amount: string, unit: 'g' | 'u'): MealRow => ({ key: food_id, food_id, amount, unit })

describe('cantidades', () => {
  it('acepta coma decimal', () => {
    expect(parseAmount('7,5')).toBe(7.5)
  })

  it('una medida casera se convierte en gramos', () => {
    expect(rowGrams(row('h', '3', 'u'), huevo)).toBe(165)
    expect(rowGrams(row('a', '7,5', 'u'), arroz)).toBe(150)
  })

  it('en gramos no se multiplica', () => {
    expect(rowGrams(row('a', '150', 'g'), arroz)).toBe(150)
  })

  it('cantidad vacía, cero o negativa vale 0', () => {
    expect(rowGrams(row('a', '', 'g'), arroz)).toBe(0)
    expect(rowGrams(row('a', '0', 'g'), arroz)).toBe(0)
    expect(rowGrams(row('a', '-5', 'g'), arroz)).toBe(0)
  })

  it('una unidad sin medida casera se trata como gramos', () => {
    expect(rowGrams(row('o', '10', 'u'), aceite)).toBe(10)
  })
})

describe('de gramos a línea editable', () => {
  it('usa medida casera cuando encaja en medios', () => {
    expect(rowFromGrams(huevo, 165, 'k')).toMatchObject({ amount: '3', unit: 'u' })
    expect(rowFromGrams(arroz, 150, 'k')).toMatchObject({ amount: '7,5', unit: 'u' })
  })

  it('usa gramos cuando no encaja o no hay medida', () => {
    expect(rowFromGrams(arroz, 95, 'k')).toMatchObject({ amount: '95', unit: 'g' })
    expect(rowFromGrams(aceite, 10, 'k')).toMatchObject({ amount: '10', unit: 'g' })
  })

  it('ida y vuelta conserva los gramos', () => {
    const r = rowFromGrams(huevo, 110, 'k')
    expect(rowGrams(r, huevo)).toBe(110)
  })
})

describe('comida completa', () => {
  const items = [{ food_id: 'h', grams: 165 }, { food_id: 'a', grams: 100 }, { food_id: 'zzz', grams: 50 }]

  it('ignora ingredientes cuyo alimento ya no existe', () => {
    expect(rowsFromItems(items, foods)).toHaveLength(2)
  })

  it('multiplicar raciones escala los gramos', () => {
    const rows = rowsFromItems(items, foods, 2)
    expect(rowGrams(rows[0], huevo)).toBe(330)
    expect(rowGrams(rows[1], arroz)).toBe(200)
  })

  it('suma calorías y proteína de las líneas', () => {
    const m = rowsMacros([row('h', '3', 'u'), row('a', '100', 'g')], foods)
    expect(m.kcal).toBeCloseTo(235.95 + 130, 2)
    expect(m.protein).toBeCloseTo(20.79 + 2.7, 2)
  })

  it('las líneas inválidas no suman ni se guardan', () => {
    const rows = [row('h', '', 'u'), row('a', '100', 'g'), row('zzz', '5', 'g')]
    expect(rowsMacros(rows, foods).kcal).toBeCloseTo(130, 5)
    expect(toStoredItems(rows, foods)).toEqual([{ food_id: 'a', name: 'Arroz cocido', grams: 100 }])
  })
})

describe('resumen', () => {
  it('acorta la lista y quita paréntesis', () => {
    const items = [
      { food_id: '1', name: 'Huevo entero', grams: 1 },
      { food_id: '2', name: 'Atún en aceite de oliva (escurrido)', grams: 1 },
      { food_id: '3', name: 'Arroz cocido', grams: 1 },
      { food_id: '4', name: 'Tomates cherry', grams: 1 },
    ]
    expect(itemsSummary(items)).toBe('Huevo entero, Atún en aceite de oliva, Arroz cocido, +1')
    expect(itemsSummary(null)).toBe('')
  })
})
