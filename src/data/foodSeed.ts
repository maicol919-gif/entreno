/**
 * Alimentos y recetas iniciales. Valores por 100 g de tablas de composición habituales (BEDCA / USDA);
 * las marcas varían, así que se pueden corregir con la etiqueta en Comida → Alimentos.
 */

export interface SeedFood {
  name: string
  kcal: number
  protein: number
  carbs: number
  fat: number
  unit_g?: number
  unit_label?: string
  unit_plural?: string
}

export interface SeedRecipe {
  name: string
  minutes: number
  meal: 'desayuno' | 'comida' | 'merienda' | 'cena' | 'cualquiera'
  tags: string[]
  steps: string[]
  items: [food: string, grams: number][]
}

export const SEED_FOODS: SeedFood[] = [
  // Proteínas
  { name: 'Huevo entero', kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5, unit_g: 55, unit_label: 'huevo', unit_plural: 'huevos' },
  { name: 'Clara de huevo (líquida)', kcal: 48, protein: 10.8, carbs: 0.7, fat: 0.2, unit_g: 15, unit_label: 'cucharada', unit_plural: 'cucharadas' },
  { name: 'Atún en aceite de oliva (escurrido)', kcal: 200, protein: 26, carbs: 0, fat: 10, unit_g: 55, unit_label: 'lata pequeña', unit_plural: 'latas pequeñas' },
  { name: 'Pechuga de pollo cocinada', kcal: 165, protein: 31, carbs: 0, fat: 3.6, unit_g: 15, unit_label: 'cucharada', unit_plural: 'cucharadas' },
  { name: 'Pechuga de pollo cruda', kcal: 110, protein: 23, carbs: 0, fat: 1.5 },
  { name: 'Gambas peladas', kcal: 85, protein: 18, carbs: 0.5, fat: 1 },
  { name: 'Salmón crudo', kcal: 200, protein: 20, carbs: 0, fat: 13 },
  { name: 'Jamón cocido', kcal: 105, protein: 17, carbs: 1, fat: 3.5, unit_g: 20, unit_label: 'loncha', unit_plural: 'lonchas' },
  { name: 'Tofu firme', kcal: 120, protein: 12, carbs: 2, fat: 7 },
  { name: 'Queso cottage', kcal: 98, protein: 11, carbs: 3.4, fat: 4.3, unit_g: 25, unit_label: 'cucharada', unit_plural: 'cucharadas' },
  { name: 'Mozzarella', kcal: 250, protein: 18, carbs: 2, fat: 19 },
  { name: 'Queso curado', kcal: 400, protein: 26, carbs: 1, fat: 33, unit_g: 7, unit_label: 'cucharada rallada', unit_plural: 'cucharadas ralladas' },
  { name: 'Yogur griego natural (entero)', kcal: 125, protein: 5.5, carbs: 4, fat: 9, unit_g: 20, unit_label: 'cucharada', unit_plural: 'cucharadas' },
  { name: 'Yogur griego 0 % grasa', kcal: 57, protein: 10, carbs: 4, fat: 0.2, unit_g: 20, unit_label: 'cucharada', unit_plural: 'cucharadas' },
  { name: 'Skyr natural', kcal: 63, protein: 11, carbs: 4, fat: 0.2 },
  { name: 'Kéfir natural', kcal: 60, protein: 3.5, carbs: 4.5, fat: 3.2 },
  // Carbohidratos
  { name: 'Arroz cocido', kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, unit_g: 20, unit_label: 'cucharada', unit_plural: 'cucharadas' },
  { name: 'Pasta integral cocida', kcal: 135, protein: 5.5, carbs: 27, fat: 1 },
  { name: 'Noodles de arroz cocidos', kcal: 110, protein: 1.6, carbs: 25, fat: 0.2 },
  { name: 'Patata cocida', kcal: 87, protein: 1.9, carbs: 20, fat: 0.1 },
  { name: 'Pan integral', kcal: 250, protein: 10, carbs: 42, fat: 3.5, unit_g: 30, unit_label: 'rebanada', unit_plural: 'rebanadas' },
  { name: 'Tortilla de trigo (wrap)', kcal: 310, protein: 8.5, carbs: 51, fat: 7.5, unit_g: 60, unit_label: 'tortilla', unit_plural: 'tortillas' },
  { name: 'Avena en hojuelas', kcal: 380, protein: 13, carbs: 60, fat: 7, unit_g: 8, unit_label: 'cucharada', unit_plural: 'cucharadas' },
  { name: 'Harina de trigo', kcal: 340, protein: 10, carbs: 72, fat: 1, unit_g: 10, unit_label: 'cucharada', unit_plural: 'cucharadas' },
  { name: 'Garbanzos cocidos (bote)', kcal: 130, protein: 7.5, carbs: 18, fat: 2.5 },
  { name: 'Tortitas de maíz con chocolate negro', kcal: 480, protein: 7, carbs: 68, fat: 19, unit_g: 10, unit_label: 'tortita', unit_plural: 'tortitas' },
  // Verduras y fruta
  { name: 'Verdura variada (congelada o microondas)', kcal: 35, protein: 2, carbs: 6, fat: 0.4 },
  { name: 'Tomate', kcal: 18, protein: 0.9, carbs: 3.9, fat: 0.2 },
  { name: 'Tomates cherry', kcal: 18, protein: 0.9, carbs: 3.9, fat: 0.2, unit_g: 15, unit_label: 'tomate cherry', unit_plural: 'tomates cherry' },
  { name: 'Tomate triturado', kcal: 25, protein: 1.3, carbs: 4.5, fat: 0.2 },
  { name: 'Champiñones', kcal: 22, protein: 3.1, carbs: 3.3, fat: 0.3 },
  { name: 'Brócoli', kcal: 34, protein: 2.8, carbs: 7, fat: 0.4 },
  { name: 'Espinacas', kcal: 23, protein: 2.9, carbs: 3.6, fat: 0.4 },
  { name: 'Frutos rojos (congelados)', kcal: 40, protein: 0.8, carbs: 8, fat: 0.3, unit_g: 40, unit_label: 'puñado', unit_plural: 'puñados' },
  // Grasas, salsas y dulces
  { name: 'Aceite de oliva', kcal: 884, protein: 0, carbs: 0, fat: 100, unit_g: 12, unit_label: 'cucharada', unit_plural: 'cucharadas' },
  { name: 'Coco rallado', kcal: 660, protein: 6.9, carbs: 24, fat: 64, unit_g: 7, unit_label: 'cucharada', unit_plural: 'cucharadas' },
  { name: 'Leche condensada', kcal: 330, protein: 7.5, carbs: 55, fat: 8.5, unit_g: 20, unit_label: 'cucharada', unit_plural: 'cucharadas' },
  { name: 'Guacamole', kcal: 150, protein: 2, carbs: 7, fat: 13, unit_g: 20, unit_label: 'cucharada', unit_plural: 'cucharadas' },
  { name: 'Salsa de soja', kcal: 60, protein: 8, carbs: 6, fat: 0, unit_g: 15, unit_label: 'cucharada', unit_plural: 'cucharadas' },
  { name: 'Mermelada', kcal: 250, protein: 0.4, carbs: 62, fat: 0.1, unit_g: 20, unit_label: 'cucharada', unit_plural: 'cucharadas' },
]

export const SEED_RECIPES: SeedRecipe[] = [
  {
    name: 'Huevos duros con atún y arroz',
    minutes: 5,
    meal: 'cena',
    tags: ['sin cocinar', 'con huevos duros ya hechos'],
    steps: [
      'Tritura los huevos duros con un tenedor.',
      'Mézclalos con el atún y un chorrito de su aceite.',
      'Añade el arroz y los tomates cherry partidos a la mitad.',
      'Sazona con sal, pimienta y unas gotas de limón.',
    ],
    items: [['Huevo entero', 165], ['Atún en aceite de oliva (escurrido)', 55], ['Arroz cocido', 40], ['Tomates cherry', 60]],
  },
  {
    name: 'Pollo, claras y arroz salteado',
    minutes: 10,
    meal: 'comida',
    tags: ['sartén', 'pollo ya cocinado'],
    steps: [
      'Calienta el aceite a fuego medio. Echa las claras y remueve hasta que cuajen; retíralas.',
      'En la misma sartén calienta el pollo desmenuzado con pimentón dulce 1-2 minutos, a fuego bajo.',
      'Añade el arroz y saltea 2-3 minutos.',
      'Vuelve a poner las claras, mezcla y ajusta la sal.',
    ],
    items: [['Pechuga de pollo cocinada', 120], ['Clara de huevo (líquida)', 95], ['Arroz cocido', 150], ['Aceite de oliva', 12]],
  },
  {
    name: 'Pastel de coco proteico',
    minutes: 25,
    meal: 'desayuno',
    tags: ['horno', 'se prepara antes', 'para llevar'],
    steps: [
      'Precalienta el horno a 180 °C y unta un molde pequeño.',
      'Bate las claras 1-2 minutos hasta que hagan espuma.',
      'Añade el yogur y la leche condensada, mezcla y echa la vainilla. Si falta dulce, unas gotas de stevia.',
      'Incorpora la avena, el coco, 1/2 cucharadita de levadura y una pizca de sal. Remueve solo hasta que se junte.',
      'Hornea 20-25 minutos (o microondas 3-4 minutos). Está listo cuando un palillo sale limpio.',
      'Sírvelo con una cucharada de yogur y frutos rojos para sumar proteína.',
    ],
    items: [['Clara de huevo (líquida)', 200], ['Yogur griego natural (entero)', 100], ['Avena en hojuelas', 40], ['Coco rallado', 18], ['Leche condensada', 20]],
  },
  {
    name: 'Desayuno de skyr, avena y huevos',
    minutes: 5,
    meal: 'desayuno',
    tags: ['sin cocinar', 'con huevos duros ya hechos'],
    steps: ['Pon el skyr en un bol.', 'Añade la avena y los frutos rojos.', 'Acompaña con los huevos duros y una pizca de sal.'],
    items: [['Skyr natural', 200], ['Avena en hojuelas', 40], ['Frutos rojos (congelados)', 80], ['Huevo entero', 110]],
  },
  {
    name: 'Wrap de pollo y guacamole',
    minutes: 7,
    meal: 'cena',
    tags: ['pollo ya cocinado', 'sartén'],
    steps: ['Saltea la verdura en una sartén 3-4 minutos y añade el pollo desmenuzado hasta que se caliente.', 'Unta el guacamole en la tortilla, rellena con la mezcla y ciérrala.', 'Dórala 1 minuto por cada lado.'],
    items: [['Tortilla de trigo (wrap)', 60], ['Pechuga de pollo cocinada', 120], ['Guacamole', 40], ['Verdura variada (congelada o microondas)', 80]],
  },
  {
    name: 'Tomate, atún y mozzarella',
    minutes: 5,
    meal: 'cena',
    tags: ['sin cocinar'],
    steps: ['Corta el tomate en rodajas y pon la mozzarella en el centro.', 'Reparte el atún escurrido por encima.', 'Aliña con aceite de oliva y orégano, y acompaña con el pan.'],
    items: [['Tomate', 200], ['Atún en aceite de oliva (escurrido)', 110], ['Mozzarella', 60], ['Pan integral', 60], ['Aceite de oliva', 10]],
  },
  {
    name: 'Ensalada de garbanzos y atún',
    minutes: 5,
    meal: 'comida',
    tags: ['sin cocinar'],
    steps: ['Enjuaga y escurre los garbanzos.', 'Mézclalos con el atún escurrido y el tomate troceado.', 'Aliña con aceite, vinagre y especias.'],
    items: [['Garbanzos cocidos (bote)', 150], ['Atún en aceite de oliva (escurrido)', 110], ['Tomate', 100], ['Aceite de oliva', 10]],
  },
  {
    name: 'Tortilla francesa con atún y pan',
    minutes: 6,
    meal: 'cena',
    tags: ['sartén'],
    steps: ['Bate los huevos con sal y mezcla el atún escurrido.', 'Cuaja en la sartén con el aceite, 1-2 minutos por lado.', 'Sirve con el pan.'],
    items: [['Huevo entero', 165], ['Atún en aceite de oliva (escurrido)', 55], ['Pan integral', 60], ['Aceite de oliva', 6]],
  },
  {
    name: 'Wok de pollo y noodles',
    minutes: 10,
    meal: 'comida',
    tags: ['sartén', 'pollo ya cocinado'],
    steps: ['Cocina la verdura y los noodles según el envase.', 'Saltea el pollo con el aceite hasta que esté caliente.', 'Mezcla todo y añade la soja (con moderación: lleva mucha sal).'],
    items: [['Pechuga de pollo cocinada', 150], ['Noodles de arroz cocidos', 150], ['Verdura variada (congelada o microondas)', 200], ['Salsa de soja', 15], ['Aceite de oliva', 8]],
  },
  {
    name: 'Arroz salteado con gambas',
    minutes: 10,
    meal: 'cena',
    tags: ['sartén'],
    steps: ['Saltea las gambas descongeladas con ajo y el aceite 2-3 minutos.', 'Añade la verdura y cocina 3 minutos.', 'Incorpora el arroz y mezcla hasta que esté caliente.'],
    items: [['Arroz cocido', 150], ['Gambas peladas', 150], ['Verdura variada (congelada o microondas)', 150], ['Aceite de oliva', 10]],
  },
  {
    name: 'Revuelto de champiñones con atún',
    minutes: 10,
    meal: 'cena',
    tags: ['sartén'],
    steps: ['Dora los champiñones laminados en el aceite.', 'Añade los huevos batidos y el atún; remueve hasta cuajar.', 'Sirve con el pan y el tomate aliñado.'],
    items: [['Huevo entero', 165], ['Champiñones', 150], ['Atún en aceite de oliva (escurrido)', 55], ['Pan integral', 60], ['Tomate', 100], ['Aceite de oliva', 8]],
  },
  {
    name: 'Patata rellena de atún y cottage',
    minutes: 12,
    meal: 'cena',
    tags: ['microondas'],
    steps: ['Cuece la patata en el microondas hasta que esté tierna (unos 8 minutos).', 'Ábrela y mezcla parte del interior con el atún y el cottage.', 'Rellénala y acompaña con la zanahoria rallada.'],
    items: [['Patata cocida', 250], ['Atún en aceite de oliva (escurrido)', 110], ['Queso cottage', 100], ['Verdura variada (congelada o microondas)', 60]],
  },
  {
    name: 'Huevos con patata y jamón',
    minutes: 15,
    meal: 'cena',
    tags: ['sartén'],
    steps: ['Cuece las patatas en el microondas y dóralas en la sartén con el aceite.', 'Añade los huevos a la plancha.', 'Pon el jamón por encima y la verdura de guarnición.'],
    items: [['Huevo entero', 165], ['Patata cocida', 200], ['Jamón cocido', 40], ['Verdura variada (congelada o microondas)', 80], ['Aceite de oliva', 8]],
  },
  {
    name: 'Pasta con atún y tomate',
    minutes: 15,
    meal: 'comida',
    tags: ['olla'],
    steps: ['Cuece la pasta.', 'Cocina el tomate triturado con las espinacas y el aceite 3-4 minutos.', 'Incorpora el atún escurrido y mezcla con la pasta.'],
    items: [['Pasta integral cocida', 200], ['Atún en aceite de oliva (escurrido)', 110], ['Tomate triturado', 120], ['Espinacas', 60], ['Aceite de oliva', 8]],
  },
  {
    name: 'Tofu con arroz y verduras',
    minutes: 12,
    meal: 'comida',
    tags: ['sartén'],
    steps: ['Seca el tofu y dóralo en dados con el aceite.', 'Saltea la verdura, añade el arroz y mezcla.', 'Termina con la soja.'],
    items: [['Tofu firme', 150], ['Arroz cocido', 150], ['Verdura variada (congelada o microondas)', 150], ['Salsa de soja', 15], ['Aceite de oliva', 8]],
  },
  {
    name: 'Salmón con patata y brócoli',
    minutes: 20,
    meal: 'cena',
    tags: ['plancha o horno'],
    steps: ['Prepara las patatas y el brócoli (microondas o vapor).', 'Cocina el salmón a la plancha con el aceite, 3-4 minutos por lado.', 'Termina con limón y eneldo.'],
    items: [['Salmón crudo', 150], ['Patata cocida', 200], ['Brócoli', 150], ['Aceite de oliva', 5]],
  },
]
