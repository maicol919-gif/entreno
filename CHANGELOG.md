# Historial de versiones

Formato: `mayor.menor`. **Menor** (2.1, 2.2…) para mejoras y correcciones; **mayor** (3.0…) para cambios grandes en la forma de usar la app.
Para publicar una versión: sube `version` en `package.json`, añade una entrada aquí y vuelve a compilar. La versión se ve en Ajustes → Versión de la app.

## 3.4 · 2026-10-19
- **Cardio en otra máquina:** en Cardio, el enlace "¿Cinta ocupada?" permite registrar bicicleta, elíptica u otra máquina por minutos, test de habla y esfuerzo. Cuenta como cardio de la sesión y no cambia el nivel ni la fase de la cinta. Una molestia anotada ahí sí activa la pausa; una sesión sin molestia no la levanta.

## 3.3 · 2026-10-19
- **Cambiar de día con la sesión en curso:** si empezaste el día equivocado, ahora puedes tocar otro día (o usar el selector) y la sesión pasa a ese día. Antes quedaba bloqueado.

## 3.2 · 2026-10-18
- **Rotación de ejercicios cada 3 ciclos (bloques A → B → C → A…).** Los 3 ejercicios principales de cada día no cambian; los accesorios (remo, hombro posterior, tríceps, bíceps, gemelo, abdomen…) rotan entre 3 opciones. El bloque A es tu rutina de siempre. En Hoy ves el bloque actual y en qué ciclo cambia.
- Si una opción del bloque está marcada como no disponible en Gimnasio, se usa la del bloque A en ese hueco.
- 19 ejercicios nuevos con guía (Remo Hammer, Pec deck inverso, Face pull, Zancada Smith, Gemelo en prensa/Smith, Plancha, Abductor, Aperturas en polea…) y referencia de peso desde un ejercicio parecido.

## 3.1 · 2026-10-18
- **Tiempo disponible:** en Hoy eliges cuánto tiempo tienes (60–120 min, normalmente 90). La app incluye el cardio y recorta de lo menos importante: primero series de los últimos ejercicios (nunca menos de 2), luego omite los últimos; los 3 principales se respetan.
- **Molestia con gravedad** (leve / moderada / fuerte) en cardio: una molestia leve que desaparece al calentar no bloquea el nivel dura; moderada o fuerte sí.
- **Piernas:** la pregunta de cómo están las piernas solo aparece en días de piernas.
- **Puntuación con estrellas** en cada ejercicio (opcional) y media visible; servirá para rotar ejercicios cada 3 ciclos.
- **Ejercicios nuevos:** Sentadilla Perfect Squat, Glute Trainer y Curl predicador con barra Z, con guía y referencia de peso desde un ejercicio parecido.

## 3.0 · 2026-10-18
- **Ciclos más claros:** un ciclo se completa al hacer los 5 días de la rutina en cualquier orden (un día repetido no cuenta doble). En Hoy ves los 5 días del ciclo con ✓ y la fecha en que hiciste cada uno. El día que se propone es el primer día pendiente después del último que entrenaste.
- **Terminar sesión avisa qué falta** (series y cardio) y deja "Terminar igual" o "Seguir entrenando".
- **Corregida la marca ✓ que a veces no quedaba guardada** si cambiabas de pantalla enseguida. Ahora se guarda al tocar y los reintentos siguen aunque cambies de ejercicio.
- **Cardio:** la pregunta de partido pasa a "Sin partido cerca / Partido hoy / Partido mañana" (hoy o mañana: solo nivel suave).
- **Cardio, calentamiento:** en el nivel media (y en la fase 3 del nivel dura) el calentamiento va 5-6-7-8 km/h y luego 1 min de recuperación antes del primer bloque, para que no termine a la misma velocidad que el bloque. La duración total no cambia.
- **Botón "El video o la explicación no coinciden"** en cada ejercicio, para que avises y se corrija.
- **Fotos del gimnasio:** subir una foto ya no pide nota ni nombres de máquinas.

## 2.9 · 2026-10-18
- Cardio: pregunta "¿Tienes partido pronto?" (sin partido / mañana / pasado mañana). Con partido mañana el tope es nivel suave; pasado mañana, hasta media.
- Pausa por molestia corregida: tras una molestia no se ofrece el nivel dura y la duración no sube de fase hasta registrar 2 sesiones seguidas sin molestia (en cualquier nivel). Antes el bloqueo no se levantaba solo.

## 2.8 · 2026-10-17
- **Comida y Cuerpo se mudaron a su propia app, Nutrición** (https://maicol919-gif.github.io/nutricion/), con la misma cuenta y los mismos datos. Entreno vuelve a ser solo entrenamiento: así un cambio en la alimentación no puede afectar a tu sesión.
- La pestaña Gimnasio vuelve a la barra, como antes de la 2.6.
- El peso corporal sigue visible en Progreso.

## 2.7 · 2026-10-17
- **Las recetas son plantillas:** al registrar una comida ves cada ingrediente con su cantidad (en gramos o medida casera), puedes cambiarla, quitar ingredientes, añadir otros y reescalar las raciones. Los totales se recalculan al instante.
- **Guardar como mi receta:** una comida modificada se puede guardar como receta propia.
- **Repetir una comida reciente** con tus mismas cantidades, en un toque.
- **Foto ahora, detalles después:** una foto de la comida (2 toques) crea una comida "por completar" que no cuenta en los totales hasta que indicas qué llevaba, con la foto a la vista. También puedes añadir foto a cualquier comida.
- **Editar** una comida ya registrada (ingredientes, cantidades, nota, foto).
- Las fotos de comidas son privadas, como las del gimnasio.

## 2.6 · 2026-10-16
- Pestaña **Comida** con tres vistas: **Mi día**, **Recetas** y **Alimentos**.
- **Mi día:** barras de proteína y calorías contra tu meta, lo que te falta, carbohidratos y grasa, comidas agrupadas (desayuno, comida, merienda, cena) y navegación por días para completar olvidos.
- **Añadir comida** en pocos toques: recetas con filtro de tiempo (≤ 5, 10, 15 min), alimentos con cantidad en gramos o en medidas caseras (cucharadas, huevos, latas), recientes y registro rápido (calorías y proteína). Nota opcional en cada comida.
- **Recetas:** 16 recetas iniciales de Mercadona con ingredientes en gramos y medidas caseras, pasos cortos y calorías, proteína, carbohidratos y grasa por ración.
- **Alimentos:** 40 alimentos con valores por 100 g, editables con la etiqueta de tu marca. Lo ya registrado no cambia si luego editas un alimento.
- Mi gimnasio pasa a Ajustes para dejar espacio en la barra de pestañas.

## 2.5 · 2026-10-16
- Pestaña **Cuerpo**: registra peso y cintura (juntos o por separado, con fecha), con media de 7 días, variación contra la semana anterior y gráficas.
- Cintura/altura con zona (meta < 0,5) y centímetros que faltan para la meta; aviso si llevas 7 días o más sin medirla.
- Veredicto del ritmo de pérdida de peso según la media semanal (muy rápido, correcto, lento o sube).
- Metas diarias en la app: altura, calorías y proteína (base del futuro módulo de alimentación).
- El peso corporal pasa de Progreso a Cuerpo.

## 2.4 · 2026-10-14
- Cardio en tres niveles según cómo sientas las piernas: dura (frescas), media (normales) y suave (cargadas). En días de pierna el tope es media.
- Duraciones que crecen por fase del ciclo (semanas 1-2, 3-4 y 5-6; la descarga vuelve a la fase 1): dura 20 → 25 → 30 min, media 25 → 28 → 30 min, suave 30 → 35 → 40 min. Los bloques duros crecen en tiempo, no en velocidad.
- Nivel media nuevo: 3 bloques continuos a ~8,5 km/h; la velocidad se ajusta ±0,5 km/h con el test de habla del último bloque.
- Cardio guiado rediseñado: inclinación a la izquierda y velocidad a la derecha (como la máquina), lista completa de tramos con el actual resaltado, tiempo total restante y marcas de bloque en la barra de progreso.
- Alerta luminosa (parpadeo de color) en cada cambio de tramo, además del pitido.
- Progreso muestra los cardios de los últimos 7 días por nivel.

## 2.3 · 2026-10-14
- La pantalla no se apaga durante toda la sesión de entreno (antes solo durante el cardio guiado).
- RIR simplificado: 0, 1, 2 y 3+ (se quitan 4 y 5).
- Se quita la casilla "Piernas cargadas" del cardio: ya se decide con la pregunta de cómo sientes las piernas.

## 2.2 · 2026-10-08
- La app comprueba la versión al abrirse y cada vez que vuelves a ella: si hay una nueva, pide actualizar de inmediato, sin esperar a que el navegador la descargue en segundo plano.

## 2.1 · 2026-10-08
- Fotos del gimnasio: sube fotos privadas (con nota y máquinas que reconoces) desde la pestaña Gimnasio y copia un enlace temporal para compartirlas.
- Cuando hay una versión nueva, la app pide actualizar antes de continuar (sin recargarse sola).
- Agujetas con palabras ("Nada" a "No puedo caminar"), para no confundir dolor con bienestar.
- El cardio ya no se guarda dos veces con un doble toque.

## 2.0 · 2026-10-07
- Cardio: pregunta "¿cómo sientes las piernas hoy?" antes de empezar y propone intervalos o caminata suave.
- Protocolo de intervalos de 20 min como base y escala de esfuerzo con palabras.
- El cardio guiado se reabre solo y sigue contando si la página se recarga.
- Cierre de ciclo con resumen al terminar el Día 5.
- Botón "Me incomodó" con motivo y reemplazos sugeridos del mismo músculo.
- Las actualizaciones ya no recargan la app solas: aparece un aviso y actualizas tú.

## 1.3 · 2026-10-02
- Rutina por número de día (el siguiente al último entrenado) y recordatorio del día pendiente.
- Cardio en cinta guiado con test de habla y progresión de una variable por sesión.
- Cardio más suave si ayer fue pierna o hay agujetas altas.
- Volumen y cardio en ventana móvil de 7 días.

## 1.2 · 2026-10-01
- Carga base automática desde el historial (doble progresión).
- Contador de descanso global siempre visible; botón "Siguiente ejercicio".
- Se detiene el descanso al terminar la sesión; versión visible en Ajustes y botón de actualización.

## 1.1 · 2026-10-01
- Guía de técnica por ejercicio y videos incrustados.
- Pestaña Progreso: series por músculo, estancados y peso corporal.
- Guardado con reintento si se pierde la señal.

## 1.0 · 2026-10-01
- Primera versión: rutina de 5 días, registro por serie con RIR, "Última vez", historial, agujetas y descarga.
