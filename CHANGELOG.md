# Historial de versiones

Formato: `mayor.menor`. **Menor** (2.1, 2.2…) para mejoras y correcciones; **mayor** (3.0…) para cambios grandes en la forma de usar la app.
Para publicar una versión: sube `version` en `package.json`, añade una entrada aquí y vuelve a compilar. La versión se ve en Ajustes → Versión de la app.

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
