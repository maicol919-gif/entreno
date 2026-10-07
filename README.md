# Entreno

App web instalable (PWA) para llevar un entrenamiento de fuerza con progresión y cardio en cinta. Pensada para un solo usuario y para usarse en el gimnasio desde el celular.

## Qué hace

- **Rutina por número de día** (Día 1 a 5): la app propone el siguiente al último que entrenaste, sin depender del día de la semana. Si te saltas uno, te lo recuerda con un toque para recuperarlo.
- **Registro por serie**: repeticiones, peso y **RIR obligatorio** (repeticiones que te quedaban en reserva). Se guarda al instante.
- **"Última vez" siempre visible** al abrir un ejercicio, con las series, el RIR y tu nota anterior.
- **Carga base automática** (doble progresión): toma el peso más exigente que repetiste en 2 o más series la última vez y propone una repetición más; si llegaste al tope del rango con el RIR objetivo, propone subir. En ejercicios con ayuda (fondos asistidos) la progresión es bajar la ayuda.
- **Descanso global**: contador siempre visible, que sobrevive a cambiar de pantalla o recargar, con vibración y sonido.
- **Guía de técnica** por ejercicio (posición, pasos, errores) y video de YouTube incrustado para la mayoría.
- **Piernas con arranque suave**: semanas 1-3 con menos series y RIR alto; descarga cada 7.ª semana; las agujetas (0-10) que anotas ajustan el volumen de la siguiente sesión de pierna.
- **Cardio en cinta guiado** al final de la sesión: intervalos de 20 min o caminata en cuesta, tramo a tramo (velocidad, inclinación, avisos), test de habla y progresión de una sola variable por sesión. Antes de empezar pregunta cómo sientes las piernas (frescas, normales, cargadas) y propone intervalos o caminata suave. El cronómetro se guarda por hora de inicio: si la página se recarga, el cardio se reabre solo y sigue contando.
- **Progreso**: series de los últimos 7 días por músculo contra su rango objetivo, ejercicios que suben o están estancados, cardio y peso corporal.
- **Cierre de ciclo**: al terminar el Día 5 muestra un resumen del ciclo y el siguiente día de entreno avisa que empieza uno nuevo.
- **Ejercicios incómodos**: botón "Me incomodó" con el motivo; la próxima vez la app propone reemplazos del mismo músculo (priorizando máquinas y poleas si el problema es apoyo o dolor) y cambias con un toque, conservando el historial.
- **Actualizaciones**: cuando hay una versión nueva, la app pide actualizar antes de continuar; no se recarga sola, y el cardio o descanso en curso se conservan.
- **Mi gimnasio**: marca qué ejercicios/máquinas tienes disponibles y sube fotos privadas de las máquinas (se guardan en Supabase Storage).

## Stack

- Front: React + TypeScript + Vite, PWA (`vite-plugin-pwa`).
- Datos y login: [Supabase](https://supabase.com) (Postgres con seguridad por filas, email + contraseña).
- Pruebas: Vitest (reglas de progresión, cardio y planificación).

## Puesta en marcha

1. Crea un proyecto en Supabase y ejecuta [`supabase/schema.sql`](supabase/schema.sql) en el SQL Editor.
2. Crea `.env.local` con la URL y la clave pública (publishable/anon) de tu proyecto:

   ```
   VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
   VITE_SUPABASE_KEY=tu_clave_publica
   ```

3. Instala y arranca:

   ```bash
   npm install
   npm run dev      # servidor de desarrollo
   npm test         # pruebas
   npm run build    # compilación en dist/
   ```

4. Abre la app, toca "Primera vez: crear cuenta" y confirma tu correo. La primera vez que entras se crean el catálogo de ejercicios y la rutina de ejemplo (ver `src/lib/seed.ts`).

> La app usa `base: '/entreno/'` en `vite.config.ts` (pensada para GitHub Pages en un repo llamado `entreno`). Cámbialo según tu hosting.

## Dónde está cada cosa

| Ruta | Contenido |
|---|---|
| `src/lib/seed.ts` | Catálogo de ejercicios y rutina de 5 días de ejemplo |
| `src/lib/progression.ts` | Doble progresión y carga base |
| `src/lib/plan.ts` | Semana del ciclo, series/RIR por semana, descarga, día pendiente, plan de cardio |
| `src/lib/treadmill.ts` | Protocolo de cinta, test de habla y reglas de progresión |
| `src/data/guides.ts` | Guías de técnica y videos |
| `src/screens/` | Pantallas: Hoy, ejercicio, cardio, progreso, historial, gimnasio, ajustes |
| `src/rest.tsx` | Contador de descanso global |
| `supabase/schema.sql` | Esquema de la base de datos |

## Notas

- Las tablas llevan `user_id` y políticas de seguridad: cada usuario solo ve sus datos. La clave pública puede estar en el front; **nunca** uses la clave de servicio (`service_role`) aquí.
- El protocolo de cinta (velocidades, bloques, recuperaciones) es un ejemplo configurable en `src/lib/treadmill.ts`. Ajústalo a tu nivel y consulta a un profesional si tienes lesiones o molestias.
- La app sugiere cargas y reglas generales basadas en prácticas habituales de entrenamiento; no sustituye el consejo de un entrenador o médico.
