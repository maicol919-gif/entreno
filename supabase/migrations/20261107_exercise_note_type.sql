-- Migration aditiva: clasifica las notas personales sin cambiar notas ni sesiones existentes.
-- Ejecutar una vez en Supabase SQL Editor antes de usar la clasificación de notas.
alter table public.session_exercise_notes
  add column if not exists note_type text not null default 'otra'
  check (note_type in ('ajuste_equipo', 'tecnica', 'preferencia', 'molestia', 'otra'));

-- Permite cerrar una sesión parcial sin contarla como completa ni avanzar el ciclo.
alter table public.sessions drop constraint if exists sessions_status_check;
alter table public.sessions
  add constraint sessions_status_check check (status in ('in_progress', 'done', 'incomplete'));

-- Descanso opcional por ejercicio. NULL conserva el valor legado de settings.rest_seconds.
alter table public.exercises
  add column if not exists rest_seconds integer
  check (rest_seconds between 15 and 900);
