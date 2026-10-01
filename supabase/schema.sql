-- Esquema de Entreno (Supabase / Postgres).
-- Ejecútalo una vez en el SQL Editor de tu proyecto de Supabase.
-- Todas las tablas tienen seguridad por filas: cada usuario solo ve y modifica lo suyo.

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  muscle_primary text not null,
  muscles_secondary text[] not null default '{}',
  equipment text,
  -- cómo se anota la carga: total, por lado, por mano, discos por lado + barra, o ayuda (fondos asistidos)
  load_type text not null default 'total' check (load_type in ('total','per_side','per_hand','plates_per_side_plus_bar','assistance')),
  bar_kg numeric not null default 0,
  min_increment_kg numeric not null default 2.5,
  rep_min int not null default 8,
  rep_max int not null default 12,
  fixed_note text,
  available boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.routine_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  weekday int not null check (weekday between 1 and 7), -- número de día de la rutina (1, 2, 3...)
  name text not null,
  unique (user_id, weekday)
);

create table public.routine_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day_id uuid not null references public.routine_days(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  position int not null,
  sets int not null default 3,
  rep_min int not null,
  rep_max int not null,
  rir_target int not null default 2,
  start_week int not null default 1,
  note text
);
create index on public.routine_items(day_id, position);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  day_id uuid references public.routine_days(id) on delete set null,
  note text,
  soreness int check (soreness between 0 and 10),
  status text not null default 'in_progress' check (status in ('in_progress','done')),
  source text not null default 'app',
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create index on public.sessions(user_id, date desc);

create table public.sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  set_number int not null,
  reps int,
  load_kg numeric,
  rir int check (rir between 0 and 6),
  is_warmup boolean not null default false,
  done boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.sets(exercise_id, session_id);

create table public.session_exercise_notes (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  note text not null default '',
  primary key (session_id, exercise_id)
);

create table public.body_weight (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  kg numeric not null,
  primary key (user_id, date)
);

create table public.settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  mesocycle_start date,
  rest_seconds int not null default 120,
  week_offset int not null default 0
);

create table public.cardio_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete set null,
  date date not null,
  kind text not null check (kind in ('liss','hiit','intervalos','recuperacion')),
  machine text,
  minutes numeric not null check (minutes > 0),
  rpe int check (rpe between 1 and 10),
  avg_hr int,
  distance_km numeric,
  note text,
  speech_test text check (speech_test in ('entera','dos','mitad')),
  protocol jsonb,
  discomfort boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.cardio_logs (user_id, date desc);

-- Seguridad por filas: cada usuario solo accede a sus propios datos.
do $$
declare t text;
begin
  foreach t in array array['exercises','routine_days','routine_items','sessions','sets','session_exercise_notes','body_weight','settings','cardio_logs']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;
