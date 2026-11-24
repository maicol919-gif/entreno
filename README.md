# Entreno

App web instalable (PWA) para llevar un entrenamiento de fuerza con progresión y cardio en cinta. Pensada para un solo usuario y para usarse en el gimnasio desde el celular.

## Qué hace

- **Rutina semanal**: lunes Pierna A; martes espalda, bíceps y core; miércoles pecho, hombros y tríceps; jueves descanso; viernes Pierna B; sábado torso completo, brazos y core; domingo descanso. Las sesiones antiguas conservan su rutina original.
- **Core dos veces por semana**: flexión de tronco en máquina, dead bug con recorrido corto y Pallof press, con pautas para cuidar el rango cómodo de cadera y hombros.
- **Registro por serie**: repeticiones, peso y **RIR obligatorio** (repeticiones que te quedaban en reserva). Se guarda al instante.
- **"Última vez" siempre visible** al abrir un ejercicio, con las series, el RIR y tu nota anterior.
- **Carga base automática** (doble progresión): toma el peso más exigente que repetiste en 2 o más series la última vez y propone una repetición más; si llegaste al tope del rango con el RIR objetivo, propone subir. En ejercicios con ayuda (fondos asistidos) la progresión es bajar la ayuda.
- **Descanso global**: contador siempre visible, que sobrevive a cambiar de pantalla o recargar, con vibración y sonido.
- **Guía de técnica** por ejercicio (posición, pasos, errores) y video de YouTube incrustado para la mayoría.
- **Piernas con arranque suave**: semanas 1-3 con menos series y RIR alto; descarga cada 7.ª semana; las agujetas (0-10) que anotas ajustan el volumen de la siguiente sesión de pierna.
- **Cardio con opciones**: plan guiado de resistencia, caminata inclinada con el protocolo personalizado o registro de otra máquina. El test de habla aparece solo durante el plan guiado.
- **Progreso**: series de los últimos 7 días por músculo contra su rango objetivo, ejercicios que suben o están estancados, cardio y peso corporal.
- **Cierre de ciclo**: al terminar el Día 5 muestra un resumen del ciclo y el siguiente día de entreno avisa que empieza uno nuevo.
- **Ejercicios incómodos**: botón "Me incomodó" con el motivo; la próxima vez la app propone reemplazos del mismo músculo (priorizando máquinas y poleas si el problema es apoyo o dolor) y cambias con un toque, conservando el historial.
- **Actualizaciones**: cuando hay una versión nueva, la app pide actualizar antes de continuar; no se recarga sola, y el cardio o descanso en curso se conservan.
- **Mi gimnasio**: marca qué ejercicios/máquinas tienes disponibles y sube fotos privadas de las máquinas (se guardan en Supabase Storage).

## Alimentación

La alimentación, el peso y la cintura viven en la app hermana **Nutrición** (repositorio `maicol919-gif/nutricion`). Las dos comparten la cuenta y este mismo proyecto de Supabase; el esquema completo está en `supabase/schema.sql`.

## Stack

- Front: React + TypeScript + Vite, PWA (`vite-plugin-pwa`).
- Datos y login: [Supabase](https://supabase.com) (Postgres con seguridad por filas, email + contraseña).
- Pruebas: Vitest (reglas de progresión, cardio y planificación).

## Puesta en marcha

1. Crea un proyecto en Supabase y ejecuta [`supabase/schema.sql`](supabase/schema.sql) en el SQL Editor.
   Si la base ya existe, aplica las migraciones en orden: [`20261107_exercise_note_type.sql`](supabase/migrations/20261107_exercise_note_type.sql) y [`20261124_evidence_routine_core.sql`](supabase/migrations/20261124_evidence_routine_core.sql). La última conserva las rutinas antiguas para leer el historial y activa la rutina semanal nueva.
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
