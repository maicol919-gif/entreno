-- Nueva versión futura del plan. Las rutinas antiguas y las sesiones que las referencian
-- se conservan sin editar; los IDs archivados siguen disponibles para leer el historial.
begin;

alter table public.routine_days add column if not exists calendar_weekday int check (calendar_weekday between 1 and 7);
alter table public.routine_days add column if not exists is_active boolean not null default true;
alter table public.routine_days drop constraint if exists routine_days_user_id_weekday_key;
create unique index if not exists routine_days_user_active_weekday_key
  on public.routine_days(user_id, weekday) where is_active;
create unique index if not exists routine_days_user_active_calendar_key
  on public.routine_days(user_id, calendar_weekday) where is_active and calendar_weekday is not null;

do $migration$
declare
  owner_id uuid;
begin
  select min(user_id::text)::uuid into owner_id from public.routine_days;
  if owner_id is null then
    raise exception 'No se encontró una rutina existente; usa el sembrado inicial de la app.';
  end if;
  if (select count(distinct user_id) from public.routine_days) <> 1 then
    raise exception 'La migración requiere aplicarse por separado a una sola cuenta.';
  end if;
  if exists (select 1 from public.routine_days where user_id = owner_id and is_active and calendar_weekday is not null) then
    raise notice 'La rutina nueva ya está activa; no se duplicó.';
    return;
  end if;

  -- Crear solo los ejercicios nuevos; no sobrescribe catálogo ni registros existentes.
  insert into public.exercises
    (user_id, name, muscle_primary, muscles_secondary, equipment, load_type, min_increment_kg, rep_min, rep_max, fixed_note)
  values
    (owner_id, 'Crunch abdominal máquina', 'Abdomen', '{}', 'Máquina abdominal', 'total', 2.5, 10, 15, null),
    (owner_id, 'Dead bug (toques de talón)', 'Abdomen', '{"Flexores de cadera"}', 'Peso corporal y colchoneta', 'total', 2.5, 6, 8,
      'Repeticiones por lado. Mantén las rodillas flexionadas y acorta el recorrido si aparece el traqueteo de ingle/cadera; detente si molesta.'),
    (owner_id, 'Pallof press de pie', 'Abdomen', '{Oblicuos}', 'Polea o banda', 'total', 1, 8, 10,
      'Repeticiones por lado. Empieza muy ligero y dentro de un rango cómodo para tus hombros; detente si aparece molestia.'),
    (owner_id, 'Abductor máquina', 'Glúteos', '{"Abductores de cadera"}', 'Máquina abductora', 'total', 2.5, 12, 20, null)
  on conflict (user_id, name) do nothing;

  update public.routine_days set is_active = false where user_id = owner_id and is_active;

  insert into public.routine_days(user_id, weekday, calendar_weekday, name)
  values
    (owner_id, 1, 1, 'Pierna A · cuádriceps y glúteos'),
    (owner_id, 2, 2, 'Espalda, bíceps y core'),
    (owner_id, 3, 3, 'Pecho, hombros y tríceps'),
    (owner_id, 4, 5, 'Pierna B · femoral y glúteos'),
    (owner_id, 5, 6, 'Torso completo, brazos y core');

  insert into public.routine_items
    (user_id, day_id, exercise_id, position, sets, rep_min, rep_max, rir_target, start_week)
  select owner_id, d.id, e.id, p.position, p.sets, p.rep_min, p.rep_max, p.rir, p.start_week
  from (values
    (1,1,'Prensa de piernas',3,8,12,2,1),
    (1,2,'Sentadilla Smith',2,8,12,2,1),
    (1,3,'Extensión de cuádriceps',3,10,15,1,1),
    (1,4,'Sentadilla búlgara',2,8,12,2,8),
    (1,5,'Elevación gemelo máquina',3,10,15,1,1),
    (2,1,'Jalón al pecho',3,8,12,2,1),
    (2,2,'Remo unilateral máquina',3,8,12,2,1),
    (2,3,'Remo unilateral banco en polea',2,10,12,2,1),
    (2,4,'Curl martillo',3,8,12,2,1),
    (2,5,'Curl a una mano polea baja',2,12,15,2,1),
    (2,6,'Crunch abdominal máquina',2,10,15,3,1),
    (2,7,'Dead bug (toques de talón)',2,6,8,3,1),
    (2,8,'Pallof press de pie',2,8,10,3,1),
    (3,1,'Press de pecho máquina horizontal',3,6,10,2,1),
    (3,2,'Press banca inclinado mancuernas',3,8,12,2,1),
    (3,3,'Press militar mancuernas',3,8,12,2,1),
    (3,4,'Elevación lateral polea baja',3,12,20,1,1),
    (3,5,'Elevación posterior cruzada polea baja',2,12,15,1,1),
    (3,6,'Extensión tríceps polea alta (una mano)',3,10,15,2,1),
    (4,1,'Curl femoral sentado',3,10,12,2,1),
    (4,2,'Hip thrust',3,8,12,2,1),
    (4,3,'Peso muerto rumano barra',2,8,12,2,8),
    (4,4,'Encogimiento aductor',2,12,15,2,1),
    (4,5,'Elevación gemelo máquina',3,12,15,1,1),
    (4,6,'Abductor máquina',3,12,20,2,1),
    (5,1,'Jalón al pecho',3,8,12,2,1),
    (5,2,'Press inclinado Smith',3,6,10,2,1),
    (5,3,'Remo pecho en banco mancuernas',3,10,12,2,1),
    (5,4,'Press de pecho máquina horizontal',2,8,12,2,1),
    (5,5,'Curl de bíceps sentado mancuernas',2,10,15,1,1),
    (5,6,'Extensión tríceps polea alta (una mano)',2,10,15,2,1),
    (5,7,'Crunch abdominal máquina',2,10,15,3,1),
    (5,8,'Dead bug (toques de talón)',2,6,8,3,1),
    (5,9,'Pallof press de pie',2,8,10,3,1)
  ) as p(day_no, position, exercise_name, sets, rep_min, rep_max, rir, start_week)
  join public.routine_days d on d.user_id = owner_id and d.weekday = p.day_no and d.is_active
  join public.exercises e on e.user_id = owner_id and e.name = p.exercise_name;
end
$migration$;

commit;
