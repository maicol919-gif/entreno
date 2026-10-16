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
  kind text not null check (kind in ('liss','hiit','intervalos','media','recuperacion')),
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

-- Evita guardar dos veces el mismo cardio en una sesión (doble toque).
create unique index if not exists cardio_logs_no_double_save on public.cardio_logs (session_id, kind, minutes) where session_id is not null;

-- Notas por ejercicio y sesión: marca de "me incomodó" y motivo.
alter table public.session_exercise_notes add column if not exists uncomfortable boolean not null default false;
alter table public.session_exercise_notes add column if not exists discomfort_reason text;
alter table public.cardio_logs add column if not exists legs_feel text check (legs_feel in ('frescas','normales','cargadas'));

-- Fotos del gimnasio (privadas por usuario).
create table public.gym_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  path text not null,
  note text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index on public.gym_photos (user_id, created_at desc);
alter table public.gym_photos enable row level security;
create policy "own rows" on public.gym_photos for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gym-photos', 'gym-photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "gym photos select own" on storage.objects for select to authenticated
  using (bucket_id = 'gym-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "gym photos insert own" on storage.objects for insert to authenticated
  with check (bucket_id = 'gym-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "gym photos delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'gym-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Cuerpo (v2.5): cintura junto al peso, y metas diarias en ajustes.
alter table public.body_weight alter column kg drop not null;
alter table public.body_weight add column if not exists waist_cm numeric check (waist_cm between 40 and 200);
alter table public.body_weight drop constraint if exists body_weight_has_value;
alter table public.body_weight add constraint body_weight_has_value check (kg is not null or waist_cm is not null);
alter table public.settings add column if not exists height_cm numeric not null default 172;
alter table public.settings add column if not exists kcal_target int not null default 2150;
alter table public.settings add column if not exists protein_target int not null default 148;

-- Alimentación (v2.6): alimentos, recetas y registro de comidas.
create table public.foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  kcal numeric not null check (kcal >= 0),
  protein numeric not null check (protein >= 0),
  carbs numeric not null check (carbs >= 0),
  fat numeric not null check (fat >= 0),
  unit_g numeric check (unit_g > 0),
  unit_label text,
  unit_plural text,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  minutes int not null check (minutes >= 0),
  meal text not null default 'cualquiera' check (meal in ('desayuno','comida','merienda','cena','cualquiera')),
  steps text not null default '',
  tags text[] not null default '{}',
  servings numeric not null default 1 check (servings > 0),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.recipe_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  food_id uuid not null references public.foods(id) on delete restrict,
  grams numeric not null check (grams > 0),
  position int not null default 0
);
create index on public.recipe_items (recipe_id);
create index on public.recipe_items (food_id);

-- Cada registro guarda una copia de los valores nutricionales: si luego cambias un alimento, el historial no se altera.
create table public.meal_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  meal text not null check (meal in ('desayuno','comida','merienda','cena')),
  recipe_id uuid references public.recipes(id) on delete set null,
  food_id uuid references public.foods(id) on delete set null,
  label text not null,
  servings numeric check (servings > 0),
  grams numeric check (grams > 0),
  kcal numeric not null check (kcal >= 0),
  protein numeric not null check (protein >= 0),
  carbs numeric not null default 0 check (carbs >= 0),
  fat numeric not null default 0 check (fat >= 0),
  note text,
  created_at timestamptz not null default now()
);
create index on public.meal_log (user_id, date desc);
create index on public.meal_log (recipe_id);
create index on public.meal_log (food_id);

alter table public.foods enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_items enable row level security;
alter table public.meal_log enable row level security;
create policy "own rows" on public.foods for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.recipes for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.recipe_items for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.meal_log for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Comidas (v2.7): ingredientes de cada registro, foto y estado "pendiente de completar".
alter table public.meal_log add column if not exists items jsonb;
alter table public.meal_log add column if not exists photo_path text;
alter table public.meal_log add column if not exists status text not null default 'done' check (status in ('done','pending'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meal-photos', 'meal-photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "meal photos select own" on storage.objects for select to authenticated
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "meal photos insert own" on storage.objects for insert to authenticated
  with check (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "meal photos delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
