import { describe, expect, it } from 'vitest'
import { foodMacros, formatServings, householdLabel, kcalState, mealForHour, proteinState, recipeMacros, remaining, roundMacros, sumMacros } from './nutrition'

const huevo = { kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5, unit_g: 55, unit_label: 'huevo', unit_plural: 'huevos' }
const arroz = { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, unit_g: 20, unit_label: 'cucharada', unit_plural: 'cucharadas' }
const aceite = { kcal: 884, protein: 0, carbs: 0, fat: 100, unit_g: null, unit_label: null, unit_plural: null }

describe('valores por gramos', () => {
  it('escala por 100 g', () => {
    const m = foodMacros(huevo, 165)
    expect(m.kcal).toBeCloseTo(235.95, 2)
    expect(m.protein).toBeCloseTo(20.79, 2)
  })

  it('cero gramos = cero', () => {
    expect(foodMacros(huevo, 0).kcal).toBe(0)
  })

  it('suma una lista vacía como cero', () => {
    expect(sumMacros([])).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 })
  })
})

describe('receta', () => {
  const foods = new Map([['h', huevo], ['a', arroz], ['o', aceite]])

  it('suma ingredientes y divide por raciones', () => {
    const items = [{ food_id: 'h', grams: 110 }, { food_id: 'a', grams: 100 }, { food_id: 'o', grams: 10 }]
    const una = recipeMacros(items, foods, 1)
    const dos = recipeMacros(items, foods, 2)
    expect(una.kcal).toBeCloseTo(157.3 + 130 + 88.4, 1)
    expect(dos.kcal).toBeCloseTo(una.kcal / 2, 5)
    expect(dos.protein).toBeCloseTo(una.protein / 2, 5)
  })

  it('ignora un ingrediente cuyo alimento no existe', () => {
    const m = recipeMacros([{ food_id: 'zzz', grams: 100 }, { food_id: 'o', grams: 10 }], foods, 1)
    expect(m.kcal).toBeCloseTo(88.4, 1)
  })
})

describe('redondeo y medidas caseras', () => {
  it('redondea kcal a entero y el resto a un decimal', () => {
    expect(roundMacros({ kcal: 412.6, protein: 36.04, carbs: 1.25, fat: 20.99 })).toEqual({ kcal: 413, protein: 36, carbs: 1.3, fat: 21 })
  })

  it('traduce gramos a unidades con plural', () => {
    expect(householdLabel(huevo, 165)).toBe('3 huevos')
    expect(householdLabel(huevo, 55)).toBe('1 huevo')
    expect(householdLabel(arroz, 150)).toBe('7,5 cucharadas')
  })

  it('sin medida o cantidad mínima no devuelve etiqueta', () => {
    expect(householdLabel(aceite, 10)).toBeNull()
    expect(householdLabel(huevo, 5)).toBeNull()
  })
})

describe('metas del día', () => {
  it('lo que falta nunca es negativo', () => {
    const r = remaining({ kcal: 2150, protein: 148 }, { kcal: 2400, protein: 100, carbs: 0, fat: 0 })
    expect(r).toEqual({ kcal: 0, protein: 48 })
  })

  it('estado de calorías con margen de 5 %', () => {
    expect(kcalState(1000, 2150)).toBe('bajo')
    expect(kcalState(2100, 2150)).toBe('ok')
    expect(kcalState(2250, 2150)).toBe('ok')
    expect(kcalState(2300, 2150)).toBe('pasado')
  })

  it('estado de proteína: se llega o no se llega', () => {
    expect(proteinState(100, 148)).toBe('bajo')
    expect(proteinState(141, 148)).toBe('ok')
    expect(proteinState(200, 148)).toBe('ok')
  })
})

describe('comida sugerida y raciones', () => {
  it('según la hora', () => {
    expect(mealForHour(8)).toBe('desayuno')
    expect(mealForHour(11)).toBe('comida')
    expect(mealForHour(15)).toBe('comida')
    expect(mealForHour(17)).toBe('merienda')
    expect(mealForHour(21)).toBe('cena')
  })

  it('formato de raciones', () => {
    expect(formatServings(1)).toBe('1 ración')
    expect(formatServings(1.5)).toBe('1,5 raciones')
    expect(formatServings(0.25)).toBe('0,25 raciones')
  })
})
