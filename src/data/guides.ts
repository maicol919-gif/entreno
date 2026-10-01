export interface Guide {
  setup: string
  steps: string[]
  errors: string[]
  /** Consulta para buscar videos de técnica en YouTube (por defecto: nombre del ejercicio). */
  query?: string
}

export const GUIDES: Record<string, Guide> = {
  'Press de pecho máquina horizontal': {
    setup: 'Ajusta el asiento para que los agarres queden a la altura de la mitad del pecho. Espalda y cabeza apoyadas, omóplatos juntos y hacia abajo.',
    steps: ['Empuja hasta casi extender, sin bloquear codos.', 'Baja en 2 s hasta sentir estiramiento del pecho (codos ~45–60° del torso).', 'Pausa breve abajo y vuelve a empujar.'],
    errors: ['Despegar la espalda del respaldo', 'Subir los hombros hacia las orejas', 'Rebotar abajo'],
  },
  'Press banca inclinado mancuernas': {
    setup: 'Banco a 30° (nota la inclinación que uses). Pies firmes, omóplatos retraídos, mancuernas a la altura del pecho alto.',
    steps: ['Empuja hacia arriba y ligeramente hacia dentro.', 'Baja controlado en 2 s hasta que las mancuernas queden a los lados del pecho.', 'Mantén antebrazos verticales.'],
    errors: ['Banco demasiado inclinado (>45°, trabaja hombro)', 'Codos abiertos a 90°', 'Arquear la espalda en exceso'],
  },
  'Press inclinado Smith': {
    setup: 'Banco inclinado a 30° con la barra a la altura del pecho alto. Omóplatos juntos, pies firmes.',
    steps: ['Desbloquea la barra y baja en 2 s hasta rozar la parte alta del pecho.', 'Empuja en línea recta sin bloquear codos.'],
    errors: ['Banco mal centrado (la barra cae al cuello)', 'Rebotar en el pecho', 'Levantar glúteos'],
  },
  'Fondos libres': {
    setup: 'En la máquina de fondos asistidos elige la ayuda (kg). Menos ayuda = más difícil; la meta es 0 kg. Inclina ligeramente el torso hacia delante para enfatizar el pecho.',
    steps: ['Baja en 2 s hasta que los hombros queden a la altura de los codos (o cómodo en el hombro).', 'Empuja sin bloquear codos.', 'Hombros abajo y lejos de las orejas.'],
    errors: ['Bajar demasiado (dolor en hombro)', 'Balancear el cuerpo', 'Encogerse de hombros'],
  },
  'Remo unilateral máquina': {
    setup: 'Pecho apoyado en la almohadilla (anota la posición). Agarre neutro, hombros relajados.',
    steps: ['Lleva el codo hacia la cadera, no hacia atrás.', 'Aprieta la espalda 1 s.', 'Estira completo controlado en 2 s.'],
    errors: ['Tirar con el bíceps', 'Despegar el pecho', 'Torcer el tronco'],
  },
  'Remo unilateral banco en polea': {
    setup: 'Apoyado en el banco (mano y rodilla/pie), espalda neutra, polea baja.',
    steps: ['Tira el codo hacia la cadera.', 'Aprieta el dorsal 1 s arriba.', 'Baja el peso en 2 s estirando el hombro sin rotar el tronco.'],
    errors: ['Rotar el torso para levantar más peso', 'Redondear la espalda', 'Encoger el hombro'],
  },
  'Remo pecho en banco mancuernas': {
    setup: 'Tumbado boca abajo en banco inclinado con el pecho apoyado; mancuernas colgando.',
    steps: ['Lleva los codos hacia atrás y arriba, aprieta omóplatos.', 'Pausa 1 s arriba.', 'Baja controlado hasta estirar.'],
    errors: ['Levantar el pecho del banco', 'Usar impulso', 'Codos demasiado abiertos (mueve hombro posterior en vez de dorsal)'],
  },
  'Jalón al pecho': {
    setup: 'Agarre un poco más ancho que los hombros, muslos fijos bajo el rodillo, torso ligeramente inclinado hacia atrás.',
    steps: ['Baja la barra hacia la parte alta del pecho llevando los codos hacia abajo y atrás.', 'Aprieta dorsales 1 s.', 'Sube controlado hasta estirar completamente.'],
    errors: ['Tirar con los brazos en vez de con la espalda', 'Balancear el torso', 'Bajar la barra detrás de la nuca'],
  },
  'Elevación posterior sentado': {
    setup: 'Sentado con el torso inclinado hacia delante, mancuernas ligeras bajo las rodillas.',
    steps: ['Abre los brazos hacia los lados con codos ligeramente flexionados.', 'Sube hasta la altura de los hombros.', 'Baja en 2 s.'],
    errors: ['Usar demasiado peso y balancear', 'Retraer omóplatos en exceso (trabaja espalda, no deltoides posterior)'],
  },
  'Elevación posterior cruzada polea baja': {
    setup: 'Polea baja, cada mano toma el cable contrario (cruzado). Ligero flexión de codos.',
    steps: ['Abre los brazos hacia atrás y afuera en arco, hasta la altura del hombro.', 'Pausa breve.', 'Vuelve lento sin soltar tensión.'],
    errors: ['Tirar con los codos muy flexionados (se convierte en remo)', 'Inclinar el tronco para ayudarte'],
  },
  'Elevación lateral polea baja': {
    setup: 'De lado a la polea baja, agarra el cable con la mano lejana. Torso quieto, codo ligeramente flexionado.',
    steps: ['Sube el brazo hacia el lado hasta la altura del hombro (o un poco menos).', 'Pausa 1 s.', 'Baja en 2–3 s.'],
    errors: ['Balancear el tronco', 'Subir con el trapecio (hombros arriba)', 'Subir por encima del hombro con la muñeca más alta que el codo'],
  },
  'Elevación unilateral isométrica': {
    setup: 'Elevación lateral de un brazo con pausa isométrica arriba. (Si la hacías de otra forma en Maru, mantén ese método y anota los detalles en la nota fija.)',
    steps: ['Sube el brazo hacia el lado hasta la altura del hombro.', 'Mantén 1–2 s sin balancear.', 'Baja lento en 2 s.'],
    errors: ['Usar impulso', 'Subir el hombro', 'Soltar el peso rápido'],
  },
  'Press militar mancuernas': {
    setup: 'Sentado con respaldo, mancuernas a la altura de las orejas, antebrazos verticales.',
    steps: ['Empuja hacia arriba hasta casi extender.', 'Baja controlado en 2 s hasta la altura de las orejas.', 'Abdomen firme.'],
    errors: ['Arquear en exceso la zona lumbar', 'Codos muy abiertos o muy pegados', 'Bloquear los codos arriba'],
  },
  'Press militar Smith': {
    setup: 'Banco vertical (o casi), barra a la altura de la barbilla. Pies firmes.',
    steps: ['Empuja la barra hacia arriba en línea recta.', 'Baja en 2 s hasta la altura de la barbilla.'],
    errors: ['Banco mal posicionado: la barra pasa delante o detrás de tu línea', 'Arquear la espalda', 'Bajar demasiado'],
  },
  'Elevación a mentón (trapecio)': {
    setup: 'Agarre algo más ancho que los hombros (barra o polea), de pie.',
    steps: ['Sube la barra pegada al cuerpo con los codos por encima de las muñecas, hasta la altura del esternón.', 'Baja controlado.'],
    errors: ['Subir demasiado alto (molestia en hombro)', 'Agarre estrecho', 'Balancear el cuerpo'],
  },
  'Encogimiento de hombros mancuernas': {
    setup: 'De pie con mancuernas a los lados, brazos rectos.',
    steps: ['Sube los hombros directamente hacia las orejas.', 'Pausa 1 s arriba.', 'Baja lento.'],
    errors: ['Rotar los hombros', 'Flexionar los codos', 'Mover la cabeza hacia delante'],
  },
  'Curl martillo': {
    setup: 'De pie (como en Maru; sentado costaría ~5-10 % menos peso). Ambos brazos a la vez, mancuernas con agarre neutro (palmas enfrentadas). Codos pegados al cuerpo.',
    steps: ['Sube las mancuernas sin mover los codos.', 'Aprieta arriba.', 'Baja en 2 s hasta extender.'],
    errors: ['Balancear el tronco', 'Adelantar los codos', 'Bajar de golpe'],
  },
  'Curl martillo alterno de pie': {
    setup: 'De pie, mancuernas con agarre neutro, un brazo a la vez.',
    steps: ['Sube un brazo mientras el otro se mantiene extendido.', 'Baja controlado antes de subir el otro.'],
    errors: ['Balancear el cuerpo', 'Mover el codo hacia delante'],
  },
  'Curl a una mano polea baja': {
    setup: 'De pie frente a la polea baja, un brazo, codo pegado al costado.',
    steps: ['Sube el agarre hacia el hombro sin mover el codo.', 'Aprieta 1 s.', 'Baja en 2–3 s hasta extender.'],
    errors: ['Echar el codo hacia delante', 'Inclinar el tronco'],
  },
  'Curl de pie polea a dos manos': {
    setup: 'De pie frente a la polea baja con barra o cuerda, codos pegados.',
    steps: ['Sube hasta la altura del pecho sin mover los codos.', 'Aprieta arriba.', 'Baja controlado.'],
    errors: ['Balanceo con la cadera', 'Soltar tensión abajo'],
  },
  'Curl de bíceps sentado mancuernas': {
    setup: 'Sentado con la espalda apoyada (o banco inclinado), mancuernas con agarre supino.',
    steps: ['Sube alternando o a la vez sin despegar la espalda.', 'Baja hasta extensión completa en 2 s.'],
    errors: ['Despegar la espalda', 'Adelantar los codos', 'Peso excesivo y media repetición'],
  },
  'Curl concentrado en máquina': {
    setup: 'Ajusta el asiento para que la parte alta de los brazos quede apoyada en la almohadilla (tipo banco predicador).',
    steps: ['Sube hasta la contracción máxima.', 'Baja lento en 2–3 s sin soltar tensión.', 'No bloquees del todo abajo si te molesta el codo.'],
    errors: ['Levantar los codos de la almohadilla', 'Rebotar abajo'],
  },
  'Press francés barra Z': {
    setup: 'Tumbado en banco, barra Z con agarre cerrado, brazos casi verticales.',
    steps: ['Baja la barra hacia la frente (o ligeramente detrás de la cabeza) flexionando solo los codos.', 'Extiende sin abrir los codos.'],
    errors: ['Abrir los codos', 'Mover los hombros', 'Bajar demasiado rápido'],
  },
  'Extensión tríceps polea alta (una mano)': {
    setup: 'Frente a la polea alta, un brazo, codo pegado al cuerpo.',
    steps: ['Extiende el codo hasta casi bloquear.', 'Aprieta 1 s.', 'Sube controlado hasta ~90°.'],
    errors: ['Mover el codo hacia delante', 'Inclinar el tronco para empujar'],
  },
  'Prensa de piernas': {
    setup: 'Pies a la anchura de los hombros, a media altura de la plataforma. Espalda baja pegada al respaldo.',
    steps: ['Baja en 2 s hasta unos 90° de rodilla (sin que la espalda baja se despegue).', 'Empuja sin bloquear las rodillas.', 'Semanas 1–3: termina con 3–4 repeticiones en reserva.'],
    errors: ['Rodillas hacia dentro', 'Despegar la zona lumbar', 'Bloquear las rodillas arriba'],
  },
  'Sentadilla Smith': {
    setup: 'Pies ligeramente adelantados respecto a la barra, anchura de hombros. Barra sobre el trapecio. Anota la posición de los pies.',
    steps: ['Baja en 2 s controlado hasta paralelo (o hasta donde mantengas la espalda neutra).', 'Empuja con todo el pie.', 'Semanas 1–3: RIR 3.'],
    errors: ['Rodillas hacia dentro', 'Despegar talones', 'Perder la espalda neutra'],
  },
  'Sentadilla abierta Smith': {
    setup: 'Pies más anchos que los hombros, puntas ligeramente hacia fuera, barra alta en espalda.',
    steps: ['Baja controlado con rodillas siguiendo la línea de los pies.', 'Sube empujando el suelo.'],
    errors: ['Rodillas colapsando hacia dentro', 'Inclinar el torso'],
  },
  'Sentadilla búlgara': {
    setup: 'Pie trasero apoyado en el banco, pie delantero a un paso largo. Mancuernas a los lados.',
    steps: ['Baja recto hasta que el muslo delantero quede casi paralelo.', 'Sube empujando con el talón delantero.', 'Entra desde la semana 8.'],
    errors: ['Pie delantero demasiado cerca', 'Inclinar mucho el torso', 'Dejar caer la rodilla hacia dentro'],
  },
  'Extensión de cuádriceps': {
    setup: 'Ajusta el respaldo para que la rodilla quede alineada con el eje de la máquina. Rodillo sobre los tobillos.',
    steps: ['Extiende las rodillas hasta casi bloquear.', 'Aprieta 1 s.', 'Baja en 2–3 s.'],
    errors: ['Usar impulso', 'Levantar los glúteos del asiento'],
  },
  'Curl femoral sentado': {
    setup: 'Ajusta el respaldo y el rodillo (sobre los tobillos). Muslos fijos.',
    steps: ['Flexiona las rodillas llevando los talones hacia abajo y atrás.', 'Aprieta 1 s.', 'Sube lento en 2–3 s.'],
    errors: ['Levantar las caderas del asiento', 'Usar impulso'],
  },
  'Hip thrust': {
    setup: 'Espalda alta apoyada en el banco, pies a la anchura de caderas. Barra o peso sobre la cadera.',
    steps: ['Empuja con los talones hasta alinear rodillas-cadera-hombros.', 'Aprieta glúteos 1 s arriba.', 'Baja en 2 s.'],
    errors: ['Hiperextender la zona lumbar', 'Pies demasiado lejos o cerca', 'Subir con empuje de espalda baja'],
  },
  'Peso muerto rumano barra': {
    setup: 'Barra a la altura de las caderas, pies a la anchura de caderas, rodillas ligeramente flexionadas.',
    steps: ['Lleva la cadera hacia atrás con la espalda neutra.', 'Baja hasta sentir el estiramiento de isquios (por debajo de rodilla o antes).', 'Sube empujando la cadera hacia delante.', 'Entra desde la semana 8: empieza con 2 series y mucho control.'],
    errors: ['Redondear la espalda', 'Flexionar demasiado las rodillas (se vuelve sentadilla)', 'Alejar la barra del cuerpo'],
  },
  'Encogimiento aductor': {
    setup: 'Máquina de aductores: ajusta el rango para que empieces cómodo (no muy abierto).',
    steps: ['Cierra las piernas controlado.', 'Pausa 1 s.', 'Abre en 2–3 s sin soltar la tensión.'],
    errors: ['Abrir demasiado el rango inicial', 'Rebotar'],
  },
  'Elevación gemelo máquina': {
    setup: 'Punta de los pies en el borde de la plataforma, talones libres.',
    steps: ['Baja el talón estirando todo lo posible (pausa 1 s abajo).', 'Sube lo más alto posible y aprieta 1 s.', 'Registra el peso TOTAL para poder compararlo.'],
    errors: ['Rebotar', 'Rango corto', 'Doblar las rodillas'],
  },
  'Crunch': {
    setup: 'Tumbado, rodillas flexionadas, manos al lado de la cabeza (sin tirar del cuello).',
    steps: ['Enrolla el tronco llevando las costillas hacia la pelvis.', 'Exhala arriba, pausa 1 s.', 'Baja lento.'],
    errors: ['Tirar del cuello', 'Subir con el impulso de las piernas'],
  },
  'Abdominales estilo bicicleta': {
    setup: 'Tumbado, lumbar pegada al suelo, manos tras la cabeza.',
    steps: ['Lleva un codo hacia la rodilla contraria mientras estiras la otra pierna.', 'Alterna a ritmo controlado.'],
    errors: ['Tirar del cuello', 'Ir demasiado rápido', 'Despegar la zona lumbar'],
  },
}

export function videoSearchUrl(name: string, query?: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query ?? `${name} técnica correcta`)}`
}

/** Videos de YouTube verificados (existen y permiten insertarse). Sin entrada = enlace de búsqueda. */
export const VIDEOS: Record<string, string> = {
  'Press de pecho máquina horizontal': 'iKX82NwLArk',
  'Press banca inclinado mancuernas': 'sL6xN9EVDfE',
  'Press inclinado Smith': 'O8L2eiGejQs',
  'Fondos libres': 'R2n9TW9yHBo',
  'Remo unilateral banco en polea': 'C7rxEp-078I',
  'Remo pecho en banco mancuernas': '8hQ-mB5G0EE',
  'Jalón al pecho': 'Bhpcj8gFVJs',
  'Elevación posterior sentado': 'RG_41P2hP0s',
  'Elevación posterior cruzada polea baja': 'vO-cQxJjMDc',
  'Elevación lateral polea baja': 'OXLuvI4GF7E',
  'Press militar mancuernas': 'bTqxQNOxhXE',
  'Press militar Smith': 'pAcFnjAH-TA',
  'Elevación a mentón (trapecio)': '0iPRIc8ttWM',
  'Encogimiento de hombros mancuernas': 'nZMqsAbKuVE',
  'Curl martillo': 'mPvlpDWIoDA',
  'Curl martillo alterno de pie': 'RHdacbwKbTo',
  'Curl de pie polea a dos manos': 'oawJQjIDZOk',
  'Curl a una mano polea baja': '6zrTd3FCgDk',
  'Curl de bíceps sentado mancuernas': '96O5mvyblQM',
  'Curl concentrado en máquina': 'DufMqfRy2Gg',
  'Extensión tríceps polea alta (una mano)': 'dRkTreltpnc',
  'Prensa de piernas': 'ccDlOeZ90hs',
  'Sentadilla Smith': 'mrQRLWGdvNg',
  'Sentadilla búlgara': 'q398FG9-oXY',
  'Extensión de cuádriceps': 'MyeQ1zCcfas',
  'Curl femoral sentado': 'CBCPBnMzsMI',
  'Peso muerto rumano barra': '1-aX-gHduwI',
  'Encogimiento aductor': 'Bafpsi0ERiI',
  'Elevación gemelo máquina': 'HObKQtrmU9g',
  'Abdominales estilo bicicleta': 'dYxamPVcKvk',
}
